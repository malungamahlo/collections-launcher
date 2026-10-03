// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import {
  ExternalOpenError,
  type ExternalOpenAdapter,
  type PreparedExternalFile,
} from '@app/platform/browser/external-open.adapter'
import { buildFileDocumentUrl } from '../model/file-document-location'
import { buildFileViewerUrl } from '../model/file-viewer-location'
import { createTestFileResource } from '../test/collection.fixtures'
import { useFileResourceActions } from './use-file-resource-actions'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const PDF = createTestFileResource({
  id: 'pdf-1',
  name: 'Handbook',
  mimeType: 'application/pdf',
})
const MARKDOWN = createTestFileResource({
  id: 'md-1',
  name: 'Notes',
  mimeType: 'text/markdown',
})
const WORD = createTestFileResource({
  id: 'doc-1',
  name: 'Contract',
  mimeType:
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
})
const SPREADSHEET = createTestFileResource({
  id: 'xls-1',
  name: 'Budget',
  mimeType: 'application/vnd.ms-excel',
})

const CONTENT = new Blob(['bytes'])
const PREPARED: PreparedExternalFile = { id: 42, fileName: 'Contract.docx' }

/** A promise settled by hand, to control when a step finishes. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

/** Fakes for every adapter the hook uses, all succeeding unless a test says otherwise. */
function createAdapters() {
  const fileContentSpies = {
    load: vi.fn<FileContentAdapter['load']>(() => Promise.resolve(CONTENT)),
    saveHandle: vi.fn(),
    saveBlob: vi.fn(),
    remove: vi.fn(),
  }
  const externalOpen = {
    hasAccess: vi.fn<ExternalOpenAdapter['hasAccess']>(() =>
      Promise.resolve(true),
    ),
    requestAccess: vi.fn<ExternalOpenAdapter['requestAccess']>(() =>
      Promise.resolve(true),
    ),
    prepare: vi.fn<ExternalOpenAdapter['prepare']>(() =>
      Promise.resolve(PREPARED),
    ),
    open: vi.fn<ExternalOpenAdapter['open']>(() => Promise.resolve()),
    cleanUp: vi.fn<ExternalOpenAdapter['cleanUp']>(() => Promise.resolve()),
  }
  const tabs = { open: vi.fn<(url: string) => Promise<void>>(() => Promise.resolve()) }
  const download = vi.fn<FileDownloadAdapter['download']>()

  return {
    fileContent: fileContentSpies as unknown as FileContentAdapter,
    fileContentSpies,
    externalOpen,
    tabs,
    fileDownload: { download } satisfies FileDownloadAdapter,
    download,
  }
}

type Adapters = ReturnType<typeof createAdapters>

/** Renders the hook and lets its start-up work (the leftover-copy clean-up) settle. */
async function renderActions(adapters: Adapters) {
  const hook = renderHook(() =>
    useFileResourceActions({
      fileContent: adapters.fileContent,
      tabs: adapters.tabs,
      externalOpen: adapters.externalOpen,
      fileDownload: adapters.fileDownload,
    }),
  )

  await act(async () => {
    await Promise.resolve()
  })

  return hook
}

describe('opening a PDF', () => {
  it('opens it as the browser’s own document, at an address ending in its file name', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(PDF))

    expect(adapters.tabs.open).toHaveBeenCalledExactlyOnceWith(
      buildFileDocumentUrl(PDF.id, 'Handbook.pdf'),
    )
    expect(result.current.notice).toBeUndefined()
  })

  it('checks the file can be read first, from the click, so a lapsed permission can be granted', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(PDF))

    expect(adapters.fileContentSpies.load).toHaveBeenCalledExactlyOnceWith(PDF.id)
    expect(adapters.fileContentSpies.load.mock.invocationCallOrder[0]).toBeLessThan(
      adapters.tabs.open.mock.invocationCallOrder[0] ?? 0,
    )
    expect(adapters.externalOpen.requestAccess).not.toHaveBeenCalled()
    expect(adapters.externalOpen.prepare).not.toHaveBeenCalled()
  })

  it('stays on the dashboard and says why when access is refused, with a way to try again', async () => {
    const adapters = createAdapters()
    adapters.fileContentSpies.load.mockRejectedValueOnce(
      new FileContentError('PERMISSION_DENIED', 'no'),
    )
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(PDF))

    expect(adapters.tabs.open).not.toHaveBeenCalled()
    expect(result.current.notice?.tone).toBe('error')
    expect(result.current.notice?.actionLabel).toBe('Try again')

    await act(async () => {
      result.current.runNoticeAction()
      await Promise.resolve()
    })

    expect(adapters.tabs.open).toHaveBeenCalledOnce()
  })

  it('says a missing file is missing, and offers no pointless retry', async () => {
    const adapters = createAdapters()
    adapters.fileContentSpies.load.mockRejectedValue(
      new FileContentError('NOT_FOUND', 'gone'),
    )
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(PDF))

    expect(adapters.tabs.open).not.toHaveBeenCalled()
    expect(result.current.notice?.actionLabel).toBeUndefined()
  })
})

describe('opening a Markdown file', () => {
  it('shows it on its own page, by navigating the current tab', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(MARKDOWN))

    expect(adapters.tabs.open).toHaveBeenCalledExactlyOnceWith(
      buildFileViewerUrl(MARKDOWN.id),
    )
  })

  it('reads nothing, asks for no permission, and shows no notice', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(MARKDOWN))

    expect(adapters.fileContentSpies.load).not.toHaveBeenCalled()
    expect(adapters.externalOpen.requestAccess).not.toHaveBeenCalled()
    expect(adapters.externalOpen.prepare).not.toHaveBeenCalled()
    expect(result.current.notice).toBeUndefined()
  })
})

describe('when the tab cannot be navigated', () => {
  it.each([
    ['a PDF', PDF],
    ['a Markdown file', MARKDOWN],
  ])('says so for %s', async (_label, resource) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const adapters = createAdapters()
    adapters.tabs.open.mockRejectedValue(new Error('nope'))
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(resource))

    expect(result.current.notice).toEqual({
      tone: 'error',
      message: `"${resource.name}" could not be opened. Try again.`,
      actionLabel: 'Try again',
    })
  })
})

describe('opening a file in its own application', () => {
  it.each([
    ['a Word document', WORD],
    ['an old Excel workbook', SPREADSHEET],
    [
      'a file of a type the registry does not know',
      createTestFileResource({
        id: 'x-1',
        name: 'Mystery',
        mimeType: 'application/x-something-new',
      }),
    ],
  ])('hands %s to its application through a temporary copy', async (_label, resource) => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(resource))

    expect(adapters.fileContentSpies.load).toHaveBeenCalledWith(resource.id)
    expect(adapters.externalOpen.prepare).toHaveBeenCalledTimes(1)
    expect(adapters.externalOpen.open).toHaveBeenCalledExactlyOnceWith(PREPARED)
    // A file of an application is never shown on the viewer page.
    expect(adapters.tabs.open).not.toHaveBeenCalled()
  })

  it('names the copy after the resource, with the extension its type calls for', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(WORD))
    await act(() => result.current.open(SPREADSHEET))

    expect(adapters.externalOpen.prepare.mock.calls).toEqual([
      ['Contract.docx', CONTENT],
      ['Budget.xls', CONTENT],
    ])
  })

  it('asks for permission straight away — before anything is read — so the browser will prompt', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    act(() => {
      void result.current.open(WORD)
    })

    // Nothing has been awaited yet: this is still the click.
    expect(adapters.externalOpen.requestAccess).toHaveBeenCalledTimes(1)
    expect(adapters.fileContentSpies.load).not.toHaveBeenCalled()

    await act(async () => {
      await Promise.resolve()
    })
  })

  it('says it is opening while the copy is being written, then that it opened a temporary copy', async () => {
    const adapters = createAdapters()
    const writing = deferred<PreparedExternalFile>()
    adapters.externalOpen.prepare.mockReturnValue(writing.promise)
    const { result } = await renderActions(adapters)

    let opening!: Promise<void>
    act(() => {
      opening = result.current.open(WORD)
    })
    expect(result.current.notice).toEqual({
      tone: 'info',
      message: 'Opening "Contract"…',
    })

    await act(async () => {
      writing.resolve(PREPARED)
      await opening
    })

    expect(result.current.notice?.tone).toBe('info')
    expect(result.current.notice?.message).toContain('Opened "Contract"')
    // The user is told once that it is a copy, so nobody edits it thinking it is the original.
    expect(result.current.notice?.message).toContain('temporary copy')
    expect(result.current.notice?.message).toContain('Save a copy')
    expect(result.current.notice?.actionLabel).toBeUndefined()
  })

  it('does not call the temporary copy a download anywhere the user reads', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.open(WORD))

    expect(result.current.notice?.message.toLowerCase()).not.toContain('download')
  })

  it('takes the "Opened" notice down by itself after ten seconds', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)
    await act(() => result.current.open(WORD))
    expect(result.current.notice).toBeDefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_900)
    })
    expect(result.current.notice).toBeDefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(result.current.notice).toBeUndefined()
  })

  it('deletes temporary copies a little over two minutes after opening one', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)
    adapters.externalOpen.cleanUp.mockClear() // the start-up clean-up doesn't count
    await act(() => result.current.open(WORD))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(adapters.externalOpen.cleanUp).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(adapters.externalOpen.cleanUp).toHaveBeenCalledTimes(1)
  })

  it('does not delete anything late once the page has gone', async () => {
    const adapters = createAdapters()
    const { result, unmount } = await renderActions(adapters)
    adapters.externalOpen.cleanUp.mockClear()
    await act(() => result.current.open(WORD))

    unmount()
    await vi.advanceTimersByTimeAsync(200_000)

    expect(adapters.externalOpen.cleanUp).not.toHaveBeenCalled()
  })

  it('ignores an earlier open that finishes after a later one', async () => {
    const adapters = createAdapters()
    const slow = deferred<PreparedExternalFile>()
    adapters.externalOpen.prepare
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ id: 43, fileName: 'Budget.xls' })
    const { result } = await renderActions(adapters)

    let first!: Promise<void>
    act(() => {
      first = result.current.open(WORD)
    })
    await act(() => result.current.open(SPREADSHEET))
    expect(result.current.notice?.message).toContain('Opened "Budget"')

    await act(async () => {
      slow.resolve(PREPARED)
      await first
    })

    // The slow first file was not opened over the newer one, and the notice is still about the second.
    expect(adapters.externalOpen.open).toHaveBeenCalledTimes(1)
    expect(adapters.externalOpen.open).toHaveBeenCalledWith({ id: 43, fileName: 'Budget.xls' })
    expect(result.current.notice?.message).toContain('Budget')
  })

  describe('when the user has not allowed it', () => {
    it('explains, offers to allow it, and reads nothing', async () => {
      const adapters = createAdapters()
      adapters.externalOpen.requestAccess.mockResolvedValue(false)
      const { result } = await renderActions(adapters)

      await act(() => result.current.open(WORD))

      expect(result.current.notice).toEqual({
        tone: 'error',
        message:
          'To open "Contract" in its own app, Collections Launcher needs a permission from Chrome.',
        actionLabel: 'Allow',
      })
      expect(adapters.fileContentSpies.load).not.toHaveBeenCalled()
      expect(adapters.externalOpen.open).not.toHaveBeenCalled()
    })

    it('asks again from the notice’s button and, once allowed, opens the file', async () => {
      const adapters = createAdapters()
      adapters.externalOpen.requestAccess.mockResolvedValueOnce(false)
      const { result } = await renderActions(adapters)
      await act(() => result.current.open(WORD))

      await act(async () => {
        result.current.runNoticeAction()
        await Promise.resolve()
      })

      expect(adapters.externalOpen.requestAccess).toHaveBeenCalledTimes(2)
      expect(adapters.externalOpen.open).toHaveBeenCalledWith(PREPARED)
    })

    it('treats access disappearing while writing the copy the same way', async () => {
      const adapters = createAdapters()
      adapters.externalOpen.prepare.mockRejectedValue(
        new ExternalOpenError('NO_ACCESS', 'no access'),
      )
      const { result } = await renderActions(adapters)

      await act(() => result.current.open(WORD))

      expect(result.current.notice?.actionLabel).toBe('Allow')
    })
  })

  describe('when the browser will only open it after another click', () => {
    async function openTooLate(adapters: Adapters) {
      adapters.externalOpen.open.mockRejectedValueOnce(
        new ExternalOpenError('NEEDS_GESTURE', 'User gesture required'),
      )
      const hook = await renderActions(adapters)
      await act(() => hook.result.current.open(WORD))

      return hook
    }

    it('says the file is ready and offers an Open button', async () => {
      const adapters = createAdapters()

      const { result } = await openTooLate(adapters)

      expect(result.current.notice).toEqual({
        tone: 'info',
        message: '"Contract" is ready.',
        actionLabel: 'Open',
      })
    })

    it('opens the very same copy on that click, without writing another', async () => {
      const adapters = createAdapters()
      const { result } = await openTooLate(adapters)

      await act(async () => {
        result.current.runNoticeAction()
        await Promise.resolve()
      })

      expect(adapters.externalOpen.prepare).toHaveBeenCalledTimes(1)
      expect(adapters.externalOpen.open).toHaveBeenCalledTimes(2)
      expect(adapters.externalOpen.open).toHaveBeenLastCalledWith(PREPARED)
      expect(result.current.notice?.message).toContain('Opened "Contract"')
    })

    it('calls the browser straight from the click, before awaiting anything', async () => {
      const adapters = createAdapters()
      const { result } = await openTooLate(adapters)

      act(() => {
        result.current.runNoticeAction()
      })

      // Still inside the click: the browser has already been asked.
      expect(adapters.externalOpen.open).toHaveBeenCalledTimes(2)

      await act(async () => {
        await Promise.resolve()
      })
    })

    it('reports a failure on that second try', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const adapters = createAdapters()
      const { result } = await openTooLate(adapters)
      adapters.externalOpen.open.mockRejectedValueOnce(
        new ExternalOpenError('OPEN_FAILED', 'Download file already deleted'),
      )

      await act(async () => {
        result.current.runNoticeAction()
        await Promise.resolve()
      })

      expect(result.current.notice?.tone).toBe('error')
      expect(result.current.notice?.message).toBe(
        '"Contract" could not be opened. Try again.',
      )
    })
  })

  describe('when something goes wrong', () => {
    it('says a missing file is missing, and offers no pointless retry', async () => {
      const adapters = createAdapters()
      adapters.fileContentSpies.load.mockRejectedValue(
        new FileContentError('NOT_FOUND', 'gone'),
      )
      const { result } = await renderActions(adapters)

      await act(() => result.current.open(WORD))

      expect(result.current.notice).toEqual({
        tone: 'error',
        message:
          '"Contract" could not be found. It may have been moved, renamed, or deleted.',
        actionLabel: undefined,
      })
      expect(adapters.externalOpen.prepare).not.toHaveBeenCalled()
    })

    it('offers to try again when the file itself was refused, and does', async () => {
      const adapters = createAdapters()
      adapters.fileContentSpies.load.mockRejectedValueOnce(
        new FileContentError('PERMISSION_DENIED', 'no'),
      )
      const { result } = await renderActions(adapters)
      await act(() => result.current.open(WORD))
      expect(result.current.notice?.actionLabel).toBe('Try again')

      await act(async () => {
        result.current.runNoticeAction()
        await Promise.resolve()
      })

      expect(adapters.externalOpen.open).toHaveBeenCalledWith(PREPARED)
    })

    it('reports a copy that could not be written, with a way to try again', async () => {
      const adapters = createAdapters()
      adapters.externalOpen.prepare.mockRejectedValue(
        new ExternalOpenError('COPY_FAILED', 'interrupted'),
      )
      const { result } = await renderActions(adapters)

      await act(() => result.current.open(WORD))

      expect(result.current.notice).toEqual({
        tone: 'error',
        message: '"Contract" could not be opened. Try again.',
        actionLabel: 'Try again',
      })
    })

    it('reports an unexpected failure and logs it', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const adapters = createAdapters()
      adapters.externalOpen.prepare.mockRejectedValue(new Error('disk on fire'))
      const { result } = await renderActions(adapters)

      await act(() => result.current.open(WORD))

      expect(result.current.notice?.tone).toBe('error')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not put a low-level message in front of the user', async () => {
      const adapters = createAdapters()
      adapters.fileContentSpies.load.mockRejectedValue(
        new FileContentError('NOT_FOUND', 'No file content is stored for resource "doc-1".'),
      )
      const { result } = await renderActions(adapters)

      await act(() => result.current.open(WORD))

      expect(result.current.notice?.message).not.toContain('doc-1')
    })
  })
})

describe('saving a copy', () => {
  it('downloads the file under the resource’s name with its extension, as an ordinary download', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.save(PDF))

    expect(adapters.fileContentSpies.load).toHaveBeenCalledWith('pdf-1')
    expect(adapters.download).toHaveBeenCalledExactlyOnceWith('Handbook.pdf', CONTENT)
    // A saved copy is the user's own doing: no hidden temporary copy is involved.
    expect(adapters.externalOpen.prepare).not.toHaveBeenCalled()
    expect(result.current.notice).toBeUndefined()
  })

  it('can save a file that opens in its own application, too', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)

    await act(() => result.current.save(WORD))

    expect(adapters.download).toHaveBeenCalledExactlyOnceWith('Contract.docx', CONTENT)
  })

  it('reports a failure, and the notice can be dismissed', async () => {
    const adapters = createAdapters()
    adapters.fileContentSpies.load.mockRejectedValue(
      new FileContentError('NOT_FOUND', 'gone'),
    )
    const { result } = await renderActions(adapters)

    await act(() => result.current.save(PDF))

    expect(result.current.notice?.tone).toBe('error')
    expect(result.current.notice?.message).toContain('nothing to save')
    expect(result.current.notice?.actionLabel).toBeUndefined()

    act(() => result.current.dismissNotice())
    expect(result.current.notice).toBeUndefined()
  })

  it('takes down an "Opened" notice, and opening takes down a save error', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)
    await act(() => result.current.open(WORD))
    expect(result.current.notice?.message).toContain('Opened')

    await act(() => result.current.save(PDF))
    expect(result.current.notice).toBeUndefined()

    adapters.fileContentSpies.load.mockRejectedValueOnce(
      new FileContentError('UNAVAILABLE', 'x'),
    )
    await act(() => result.current.save(PDF))
    expect(result.current.notice?.tone).toBe('error')

    await act(() => result.current.open(WORD))
    expect(result.current.notice?.message).toContain('Opened "Contract"')
  })
})

describe('housekeeping', () => {
  it('removes copies left over from earlier when the dashboard opens, if access was given', async () => {
    const adapters = createAdapters()

    await renderActions(adapters)

    expect(adapters.externalOpen.cleanUp).toHaveBeenCalledTimes(1)
  })

  it('does nothing about them when access was never given', async () => {
    const adapters = createAdapters()
    adapters.externalOpen.hasAccess.mockResolvedValue(false)

    await renderActions(adapters)

    expect(adapters.externalOpen.cleanUp).not.toHaveBeenCalled()
    expect(adapters.externalOpen.requestAccess).not.toHaveBeenCalled()
  })

  it('leaves a dismissed notice’s file alone: dismissing hides only the message', async () => {
    const adapters = createAdapters()
    const { result } = await renderActions(adapters)
    await act(() => result.current.open(WORD))

    act(() => result.current.dismissNotice())

    expect(result.current.notice).toBeUndefined()
    expect(adapters.externalOpen.cleanUp).toHaveBeenCalledTimes(1) // only the start-up one
  })
})
