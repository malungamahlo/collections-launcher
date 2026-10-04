// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestFileResource } from '@app/features/collections/test/collection.fixtures'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import { bundleFileName } from '../model/bundle-file'
import {
  createEmptyTestCollection,
  createSingleResourceTestCollection,
} from '../test/portability.fixtures'
import { useExportCollection } from './use-export-collection'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const HANDBOOK = createTestFileResource({ id: 'file-1', name: 'Handbook' })
const WITH_FILE = createEmptyTestCollection({ name: 'Reading', resources: [HANDBOOK] })

/** A promise settled by hand, to hold an export part-way. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function renderExport(
  load: FileContentAdapter['load'] = () => Promise.resolve(new Blob(['%PDF-1.7'])),
) {
  const download = vi.fn<FileDownloadAdapter['download']>()
  const fileContent = { load: vi.fn(load) }
  const hook = renderHook(() =>
    useExportCollection({ fileDownload: { download }, fileContent }),
  )

  return { ...hook, download, fileContent }
}

describe('useExportCollection', () => {
  it('downloads a package named after the collection, holding its files', async () => {
    const { result, download } = renderExport()

    await act(() => result.current.exportCollection(WITH_FILE))

    expect(download).toHaveBeenCalledOnce()
    const [fileName, contents] = download.mock.calls[0] as [string, Blob]
    expect(fileName).toBe(bundleFileName('Reading'))
    const zip = await JSZip.loadAsync(await contents.arrayBuffer())
    expect(await zip.file('attachments/0001.pdf')?.async('string')).toBe('%PDF-1.7')
    expect(JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '').collection.name).toBe(
      'Reading',
    )
    // Success has no notice of its own: the browser's download says it.
    expect(result.current.notice).toBeUndefined()
  })

  it('exports a collection of websites too', async () => {
    const { result, download, fileContent } = renderExport()

    await act(() => result.current.exportCollection(createSingleResourceTestCollection()))

    expect(download).toHaveBeenCalledOnce()
    expect(fileContent.load).not.toHaveBeenCalled()
  })

  it('says it is exporting, and how far it has got, while it works', async () => {
    const reading = deferred<ArrayBuffer>()
    const { result, download } = renderExport(() =>
      Promise.resolve({ size: 8, arrayBuffer: () => reading.promise } as unknown as Blob),
    )

    let exporting!: Promise<void>
    act(() => {
      exporting = result.current.exportCollection(WITH_FILE)
    })
    expect(result.current.notice).toEqual({ tone: 'info', message: 'Exporting "Reading"…' })

    await vi.waitFor(() =>
      expect(result.current.notice?.message).toBe('Exporting "Reading"… 0 of 1 file'),
    )
    expect(download).not.toHaveBeenCalled()

    await act(async () => {
      reading.resolve(new ArrayBuffer(8))
      await exporting
    })

    expect(download).toHaveBeenCalledOnce()
    expect(result.current.notice).toBeUndefined()
  })

  it.each([
    [
      'NOT_FOUND' as const,
      '"Reading" was not exported: "Handbook" could not be found. It may have been moved, renamed, or deleted. Remove it from the collection, or add it again, then export.',
    ],
    [
      'PERMISSION_DENIED' as const,
      '"Reading" was not exported: access to "Handbook" was not granted. Export again and allow access when the browser asks.',
    ],
    ['UNAVAILABLE' as const, '"Reading" was not exported: "Handbook" could not be read. Try again.'],
  ])('stops and names the file when it cannot be read (%s), downloading nothing', async (code, message) => {
    const { result, download } = renderExport(() =>
      Promise.reject(new FileContentError(code, 'no')),
    )

    await act(() => result.current.exportCollection(WITH_FILE))

    expect(download).not.toHaveBeenCalled()
    expect(result.current.notice).toEqual({ tone: 'error', message })
  })

  it('says a file is too large for an export, with both sizes', async () => {
    const { result, download } = renderExport(() =>
      Promise.resolve({ size: 120 * 1024 * 1024 } as unknown as Blob),
    )

    await act(() => result.current.exportCollection(WITH_FILE))

    expect(download).not.toHaveBeenCalled()
    expect(result.current.notice?.message).toBe(
      '"Reading" was not exported: "Handbook" is 120 MB, and a file in an export can be at most 100 MB.',
    )
  })

  it('says when the files together are too much, with the total and the limit', async () => {
    const files = Array.from({ length: 6 }, (_, index) =>
      createTestFileResource({ id: `big-${index}`, name: `Big ${index}` }),
    )
    const { result, download } = renderExport(() =>
      Promise.resolve({ size: 90 * 1024 * 1024 } as unknown as Blob),
    )

    await act(() =>
      result.current.exportCollection(createEmptyTestCollection({ name: 'Decks', resources: files })),
    )

    expect(download).not.toHaveBeenCalled()
    expect(result.current.notice?.message).toBe(
      '"Decks" was not exported: its files add up to 540 MB, and an export can hold at most 500 MB.',
    )
  })

  it('reports an unexpected failure plainly, and logs it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const download = vi.fn(() => {
      throw new Error('boom')
    })
    const { result } = renderHook(() =>
      useExportCollection({
        fileDownload: { download },
        fileContent: { load: vi.fn() },
      }),
    )

    await act(() => result.current.exportCollection(createSingleResourceTestCollection()))

    expect(result.current.notice).toEqual({
      tone: 'error',
      message: '"Development" could not be exported. Try again.',
    })
    expect(consoleError).toHaveBeenCalled()
  })

  it('lets a failure be dismissed, and a new export clears it', async () => {
    const { result, fileContent } = renderExport()
    fileContent.load.mockRejectedValueOnce(new FileContentError('NOT_FOUND', 'gone'))

    await act(() => result.current.exportCollection(WITH_FILE))
    expect(result.current.notice?.tone).toBe('error')

    act(() => result.current.dismissNotice())
    expect(result.current.notice).toBeUndefined()

    fileContent.load.mockRejectedValueOnce(new FileContentError('NOT_FOUND', 'gone'))
    await act(() => result.current.exportCollection(WITH_FILE))
    await act(() => result.current.exportCollection(WITH_FILE))
    expect(result.current.notice).toBeUndefined()
  })

  it('ignores a second click while an export is still running', async () => {
    const reading = deferred<ArrayBuffer>()
    const { result, download, fileContent } = renderExport(() =>
      Promise.resolve({ size: 8, arrayBuffer: () => reading.promise } as unknown as Blob),
    )

    let first!: Promise<void>
    act(() => {
      first = result.current.exportCollection(WITH_FILE)
    })
    await act(() => result.current.exportCollection(WITH_FILE))

    await act(async () => {
      reading.resolve(new ArrayBuffer(8))
      await first
    })

    expect(fileContent.load).toHaveBeenCalledTimes(1)
    expect(download).toHaveBeenCalledOnce()
  })
})
