// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  BrowserExternalOpenAdapter,
  ExternalOpenError,
} from './external-open.adapter'

type Delta = { id: number; state?: { current?: string } }
type DownloadOptions = {
  url: string
  filename: string
  conflictAction: string
  saveAs: boolean
}
type SearchQuery = { id?: number; startedBefore?: string }
type Item = {
  id: number
  state: string
  exists: boolean
  byExtensionId?: string
}

/**
 * A stand-in for `browser.downloads`, which the fake browser does not implement
 * (and which does not exist at all until the permission is granted).
 */
function createFakeDownloads() {
  const listeners = new Set<(delta: Delta) => void>()
  const calls: string[] = []

  let nextId = 7
  const downloads = {
    download: vi.fn(async (options: DownloadOptions): Promise<number> => {
      void options
      calls.push('download')
      return nextId++
    }),
    search: vi.fn(async (query?: SearchQuery): Promise<Item[]> => {
      void query
      return []
    }),
    open: vi.fn(async (id: number): Promise<void> => {
      void id
    }),
    removeFile: vi.fn(async (id: number): Promise<void> => {
      void id
    }),
    erase: vi.fn(async (query: SearchQuery): Promise<number[]> => {
      void query
      return []
    }),
    setUiOptions: vi.fn(async (options: { enabled: boolean }) => {
      calls.push(`ui:${options.enabled ? 'on' : 'off'}`)
    }),
    onChanged: {
      addListener: vi.fn((next: (delta: Delta) => void) => {
        listeners.add(next)
      }),
      removeListener: vi.fn((previous: (delta: Delta) => void) => {
        listeners.delete(previous)
      }),
    },
  }

  return {
    downloads,
    calls,
    /** Delivers a change event to every listener, as the browser would. */
    emit: (delta: Delta) => [...listeners].forEach(listener => listener(delta)),
    /** Whether any change listener is currently attached. */
    hasListener: () => listeners.size > 0,
    listenerCount: () => listeners.size,
  }
}

let fake: ReturnType<typeof createFakeDownloads>
const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()
/** The fake browser's own `downloads`, put back after each test so `reset()` still works. */
const originalDownloads: unknown = (browser as { downloads?: unknown }).downloads

/** Makes `browser.downloads` exist (or not), as it does with and without the permission. */
function setDownloads(value: unknown): void {
  Object.defineProperty(browser, 'downloads', {
    value,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  fakeBrowser.reset()
  fake = createFakeDownloads()
  setDownloads(fake.downloads)
  createObjectURL.mockReset().mockReturnValue('blob:copy')
  revokeObjectURL.mockReset()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setDownloads(originalDownloads)
})

const CONTENT = new Blob(['docx bytes'])

/** Starts preparing a copy and finishes writing it, resolving with the result. */
async function prepareAndComplete(
  adapter: BrowserExternalOpenAdapter,
  fileName = 'Contract.docx',
  downloadId = 7,
) {
  const prepared = adapter.prepare(fileName, CONTENT)

  await vi.waitFor(() => expect(fake.hasListener()).toBe(true))
  fake.emit({ id: downloadId, state: { current: 'complete' } })

  return prepared
}

/**
 * Spies on an overloaded `browser.permissions` method (callback and promise
 * forms), which needs the cast the rest of the project's tests use.
 */
function spyOnPermissions(method: 'contains' | 'request') {
  return vi.spyOn(browser.permissions, method) as unknown as MockInstance<
    (permissions: unknown) => Promise<boolean>
  >
}

describe('BrowserExternalOpenAdapter access', () => {
  it('asks the browser for exactly the three downloads permissions', async () => {
    const contains = spyOnPermissions('contains').mockResolvedValue(true)
    const request = spyOnPermissions('request').mockResolvedValue(true)
    const adapter = new BrowserExternalOpenAdapter()

    expect(await adapter.hasAccess()).toBe(true)
    expect(await adapter.requestAccess()).toBe(true)

    const expected = {
      permissions: ['downloads', 'downloads.open', 'downloads.ui'],
    }
    expect(contains).toHaveBeenCalledWith(expected)
    expect(request).toHaveBeenCalledWith(expected)
  })

  it('reports the permissions as not granted when the user refuses', async () => {
    spyOnPermissions('request').mockResolvedValue(false)

    expect(await new BrowserExternalOpenAdapter().requestAccess()).toBe(false)
  })

  it('treats a failing permissions call as not granted rather than throwing', async () => {
    spyOnPermissions('contains').mockRejectedValue(new Error('x'))
    spyOnPermissions('request').mockRejectedValue(
      new Error('This function must be called during a user gesture'),
    )
    const adapter = new BrowserExternalOpenAdapter()

    expect(await adapter.hasAccess()).toBe(false)
    expect(await adapter.requestAccess()).toBe(false)
  })
})

describe('BrowserExternalOpenAdapter.prepare', () => {
  it('writes the copy into a folder of its own inside the temporary folder', async () => {
    const adapter = new BrowserExternalOpenAdapter()

    const prepared = await prepareAndComplete(adapter)

    expect(prepared).toEqual({ id: 7, fileName: 'Contract.docx' })
    expect(fake.downloads.download).toHaveBeenCalledWith({
      url: 'blob:copy',
      filename: expect.stringMatching(
        /^Collections Launcher \(temporary\)\/[0-9a-f-]{36}\/Contract\.docx$/,
      ),
      conflictAction: 'uniquify',
      saveAs: false,
    })
    expect(createObjectURL).toHaveBeenCalledWith(CONTENT)
  })

  it('gives every copy a folder of its own', async () => {
    const adapter = new BrowserExternalOpenAdapter()

    await prepareAndComplete(adapter, 'Contract.docx', 7)
    await prepareAndComplete(adapter, 'Contract.docx', 8)

    const folders = fake.downloads.download.mock.calls.map(
      call => (call as unknown as [{ filename: string }])[0].filename.split('/')[1],
    )
    expect(new Set(folders).size).toBe(2)
  })

  it('hides the browser’s download interface while writing, and shows it again after', async () => {
    await prepareAndComplete(new BrowserExternalOpenAdapter())

    expect(fake.calls).toEqual(['ui:off', 'download', 'ui:on'])
  })

  it('revokes the object URL once the copy is written', async () => {
    await prepareAndComplete(new BrowserExternalOpenAdapter())

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:copy')
  })

  it('stops listening once it is done', async () => {
    await prepareAndComplete(new BrowserExternalOpenAdapter())

    expect(fake.hasListener()).toBe(false)
  })

  it('ignores changes to other downloads', async () => {
    const adapter = new BrowserExternalOpenAdapter()
    const prepared = adapter.prepare('Contract.docx', CONTENT)
    let settled = false
    void prepared.then(() => {
      settled = true
    })

    await vi.waitFor(() => expect(fake.hasListener()).toBe(true))
    fake.emit({ id: 99, state: { current: 'complete' } })
    await Promise.resolve()

    expect(settled).toBe(false)

    fake.emit({ id: 7, state: { current: 'complete' } })
    await prepared
  })

  it('notices a copy that finished before it started listening', async () => {
    fake.downloads.search.mockResolvedValue([
      { id: 7, state: 'complete', exists: true },
    ])

    const prepared = await new BrowserExternalOpenAdapter().prepare(
      'Contract.docx',
      CONTENT,
    )

    expect(prepared.id).toBe(7)
  })

  it('fails with COPY_FAILED when the write is interrupted, and still restores the interface', async () => {
    const adapter = new BrowserExternalOpenAdapter()
    const prepared = adapter.prepare('Contract.docx', CONTENT)
    const outcome = prepared.catch((error: unknown) => error)

    await vi.waitFor(() => expect(fake.hasListener()).toBe(true))
    fake.emit({ id: 7, state: { current: 'interrupted' } })

    const error = await outcome
    expect(error).toBeInstanceOf(ExternalOpenError)
    expect((error as ExternalOpenError).code).toBe('COPY_FAILED')
    expect(fake.calls).toEqual(['ui:off', 'download', 'ui:on'])
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('fails with COPY_FAILED when the browser refuses to start the copy, and restores the interface', async () => {
    fake.downloads.download.mockRejectedValue(new Error('Invalid filename'))

    const error = await new BrowserExternalOpenAdapter()
      .prepare('Contract.docx', CONTENT)
      .catch((thrown: unknown) => thrown)

    expect((error as ExternalOpenError).code).toBe('COPY_FAILED')
    expect(fake.calls).toEqual(['ui:off', 'ui:on'])
    expect(revokeObjectURL).toHaveBeenCalled()
  })

  it('gives up on a copy that never finishes', async () => {
    vi.useFakeTimers()
    const adapter = new BrowserExternalOpenAdapter()
    const outcome = adapter
      .prepare('Contract.docx', CONTENT)
      .catch((thrown: unknown) => thrown)

    await vi.advanceTimersByTimeAsync(61_000)

    const error = await outcome
    expect((error as ExternalOpenError).code).toBe('COPY_FAILED')
    expect(fake.hasListener()).toBe(false)
  })

  it('still writes the copy when the download interface cannot be hidden', async () => {
    fake.downloads.setUiOptions.mockRejectedValue(new Error('no downloads.ui'))

    const prepared = await prepareAndComplete(new BrowserExternalOpenAdapter())

    expect(prepared.id).toBe(7)
  })

  it('hides the interface once for overlapping copies and shows it only after the last', async () => {
    const adapter = new BrowserExternalOpenAdapter()

    // The fake hands out ids 7 and 8.
    const first = adapter.prepare('One.docx', CONTENT)
    const second = adapter.prepare('Two.docx', CONTENT)
    await vi.waitFor(() => expect(fake.listenerCount()).toBe(2))

    fake.emit({ id: 7, state: { current: 'complete' } })
    await first
    // One copy is still being written, so the interface must stay hidden.
    expect(fake.calls).toEqual(['ui:off', 'download', 'download'])

    fake.emit({ id: 8, state: { current: 'complete' } })
    await second
    expect(fake.calls).toEqual(['ui:off', 'download', 'download', 'ui:on'])
  })

  it('fails with NO_ACCESS when the browser has not given access to downloads', async () => {
    setDownloads(undefined)

    const error = await new BrowserExternalOpenAdapter()
      .prepare('Contract.docx', CONTENT)
      .catch((thrown: unknown) => thrown)

    expect((error as ExternalOpenError).code).toBe('NO_ACCESS')
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})

describe('BrowserExternalOpenAdapter.open', () => {
  it('opens the copy by its browser id', async () => {
    await new BrowserExternalOpenAdapter().open({ id: 7, fileName: 'Contract.docx' })

    expect(fake.downloads.open).toHaveBeenCalledWith(7)
  })

  it('says a click is needed when the browser refuses for want of one', async () => {
    fake.downloads.open.mockRejectedValue(new Error('User gesture required'))

    const error = await new BrowserExternalOpenAdapter()
      .open({ id: 7, fileName: 'Contract.docx' })
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ExternalOpenError)
    expect((error as ExternalOpenError).code).toBe('NEEDS_GESTURE')
  })

  it('reports any other refusal as OPEN_FAILED', async () => {
    fake.downloads.open.mockRejectedValue(new Error('Download file already deleted'))

    const error = await new BrowserExternalOpenAdapter()
      .open({ id: 7, fileName: 'Contract.docx' })
      .catch((thrown: unknown) => thrown)

    expect((error as ExternalOpenError).code).toBe('OPEN_FAILED')
  })

  it('fails with NO_ACCESS without the downloads permission', async () => {
    setDownloads(undefined)

    const error = await new BrowserExternalOpenAdapter()
      .open({ id: 7, fileName: 'Contract.docx' })
      .catch((thrown: unknown) => thrown)

    expect((error as ExternalOpenError).code).toBe('NO_ACCESS')
  })
})

describe('BrowserExternalOpenAdapter.cleanUp', () => {
  const OURS = () => browser.runtime.id

  it('switches the download interface back on, in case a page closed while it was off', async () => {
    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.calls).toEqual(['ui:on'])
  })

  it('only looks at copies started more than two minutes ago', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T12:00:00.000Z'))

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.search).toHaveBeenCalledWith({
      startedBefore: '2026-09-21T11:58:00.000Z',
    })
  })

  it("deletes this extension's copies and forgets them", async () => {
    fake.downloads.search.mockResolvedValue([
      { id: 1, state: 'complete', exists: true, byExtensionId: OURS() },
      { id: 2, state: 'complete', exists: true, byExtensionId: OURS() },
    ])

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.removeFile.mock.calls).toEqual([[1], [2]])
    expect(fake.downloads.erase.mock.calls).toEqual([[{ id: 1 }], [{ id: 2 }]])
  })

  it("never touches a download the extension did not start", async () => {
    fake.downloads.search.mockResolvedValue([
      { id: 1, state: 'complete', exists: true },
      { id: 2, state: 'complete', exists: true, byExtensionId: 'someone-else' },
    ])

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.removeFile).not.toHaveBeenCalled()
    expect(fake.downloads.erase).not.toHaveBeenCalled()
  })

  it('forgets a copy whose file is already gone without trying to delete it', async () => {
    fake.downloads.search.mockResolvedValue([
      { id: 1, state: 'complete', exists: false, byExtensionId: OURS() },
    ])

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.removeFile).not.toHaveBeenCalled()
    expect(fake.downloads.erase).toHaveBeenCalledWith({ id: 1 })
  })

  it('keeps a copy the application still has open, to try again next time', async () => {
    fake.downloads.search
      .mockResolvedValueOnce([
        { id: 1, state: 'complete', exists: true, byExtensionId: OURS() },
      ])
      // The re-check after the failed delete: the file is still there.
      .mockResolvedValueOnce([
        { id: 1, state: 'complete', exists: true, byExtensionId: OURS() },
      ])
    fake.downloads.removeFile.mockRejectedValue(new Error('in use'))

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.erase).not.toHaveBeenCalled()
  })

  it('forgets the record when a failed delete turns out to be because the file is already gone', async () => {
    fake.downloads.search
      .mockResolvedValueOnce([
        { id: 1, state: 'complete', exists: true, byExtensionId: OURS() },
      ])
      .mockResolvedValueOnce([
        { id: 1, state: 'complete', exists: false, byExtensionId: OURS() },
      ])
    fake.downloads.removeFile.mockRejectedValue(new Error('Download file already deleted'))

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.erase).toHaveBeenCalledWith({ id: 1 })
  })

  it('carries on with the next copy when one cannot be deleted', async () => {
    fake.downloads.search.mockImplementation(async (query?: SearchQuery) => {
      const id = query?.id

      return id === undefined
        ? [
            { id: 1, state: 'complete', exists: true, byExtensionId: OURS() },
            { id: 2, state: 'complete', exists: true, byExtensionId: OURS() },
          ]
        : [{ id, state: 'complete', exists: true, byExtensionId: OURS() }]
    })
    fake.downloads.removeFile.mockImplementation(async (id: number) => {
      if (id === 1) {
        throw new Error('in use')
      }
    })

    await new BrowserExternalOpenAdapter().cleanUp()

    expect(fake.downloads.erase).toHaveBeenCalledTimes(1)
    expect(fake.downloads.erase).toHaveBeenCalledWith({ id: 2 })
  })

  it('never throws, even when the browser will not search', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    fake.downloads.search.mockRejectedValue(new Error('boom'))

    await expect(new BrowserExternalOpenAdapter().cleanUp()).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
  })

  it('does nothing at all without the downloads permission', async () => {
    setDownloads(undefined)

    await expect(new BrowserExternalOpenAdapter().cleanUp()).resolves.toBeUndefined()
  })
})
