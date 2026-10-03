// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import type { FileResource } from '../model/collection.types'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { createTestFileResource } from '../test/collection.fixtures'
import { useFileViewer } from './use-file-viewer'

afterEach(() => {
  cleanup()
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

/** A file-content adapter whose `load` is scripted and whose writes are spied on. */
function createFileContent(load: (id: string) => Promise<Blob>) {
  const spies = {
    saveHandle: vi.fn(() => Promise.resolve()),
    saveBlob: vi.fn(() => Promise.resolve()),
    load: vi.fn(load),
    remove: vi.fn(() => Promise.resolve()),
  }

  return { fileContent: spies as unknown as FileContentAdapter, spies }
}

/** A promise settled by hand, to control when a read finishes. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const replaceLocation = vi.fn<(url: string) => void>()

afterEach(() => {
  replaceLocation.mockReset()
})

/** Renders the hook and waits for its first read to settle. */
async function renderViewer(
  fileContent: FileContentAdapter,
  resource: FileResource,
  { documentUnavailable = false } = {},
) {
  const hook = renderHook(
    (props: { resource: FileResource }) =>
      useFileViewer({
        fileContent,
        resource: props.resource,
        replaceLocation,
        documentUnavailable,
      }),
    { initialProps: { resource } },
  )

  await act(async () => {
    await Promise.resolve()
  })

  return hook
}

describe('useFileViewer', () => {
  it('starts out loading, then replaces the page with a readable PDF’s document address', async () => {
    const pending = deferred<Blob>()
    const { fileContent, spies } = createFileContent(() => pending.promise)
    const { result } = renderHook(() =>
      useFileViewer({ fileContent, resource: PDF, replaceLocation }),
    )

    expect(result.current.state).toEqual({ status: 'loading' })
    expect(spies.load).toHaveBeenCalledWith('pdf-1')
    expect(replaceLocation).not.toHaveBeenCalled()

    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    await act(async () => pending.resolve(blob))

    expect(result.current.state).toEqual({ status: 'opening-document' })
    expect(replaceLocation).toHaveBeenCalledExactlyOnceWith('/file/pdf-1/Handbook.pdf')
  })

  it('does not replace the page with a PDF that cannot be read', async () => {
    const { fileContent } = createFileContent(() =>
      Promise.reject(new FileContentError('PERMISSION_DENIED', 'no')),
    )

    await renderViewer(fileContent, PDF)

    expect(replaceLocation).not.toHaveBeenCalled()
  })

  it('never sends a Markdown file to a document address', async () => {
    const { fileContent } = createFileContent(() => Promise.resolve(new Blob(['# x'])))

    await renderViewer(fileContent, MARKDOWN)

    expect(replaceLocation).not.toHaveBeenCalled()
  })

  describe('when the document address could not serve the PDF', () => {
    it('shows it on this page instead of sending the tab straight back', async () => {
      const blob = new Blob(['%PDF'])
      const { fileContent } = createFileContent(() => Promise.resolve(blob))

      const { result } = await renderViewer(fileContent, PDF, {
        documentUnavailable: true,
      })

      expect(result.current.state).toEqual({ status: 'pdf', blob })
      expect(replaceLocation).not.toHaveBeenCalled()
    })

    it('goes to the document address once the user tries again', async () => {
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(new Blob(['%PDF'])),
      )
      spies.load.mockRejectedValueOnce(
        new FileContentError('PERMISSION_DENIED', 'no'),
      )
      const { result } = await renderViewer(fileContent, PDF, {
        documentUnavailable: true,
      })
      expect(result.current.state.status).toBe('error')

      act(() => result.current.retry())
      await act(async () => {
        await Promise.resolve()
      })

      expect(replaceLocation).toHaveBeenCalledExactlyOnceWith('/file/pdf-1/Handbook.pdf')
    })
  })

  it('reads a Markdown file as text', async () => {
    const { fileContent } = createFileContent(() =>
      Promise.resolve(new Blob(['# Title\n\nBody'], { type: 'text/markdown' })),
    )

    const { result } = await renderViewer(fileContent, MARKDOWN)

    expect(result.current.state).toEqual({
      status: 'markdown',
      text: '# Title\n\nBody',
      isTruncated: false,
    })
  })

  it('renders only the start of a Markdown file larger than the preview limit', async () => {
    const oversized = new Blob(['a'.repeat(MARKDOWN_PREVIEW_MAX_BYTES + 500)])
    const { fileContent } = createFileContent(() => Promise.resolve(oversized))

    const { result } = await renderViewer(fileContent, MARKDOWN)

    const state = result.current.state
    expect(state.status).toBe('markdown')
    if (state.status === 'markdown') {
      expect(state.isTruncated).toBe(true)
      expect(state.text.length).toBe(MARKDOWN_PREVIEW_MAX_BYTES)
    }
  })

  it('does not truncate a Markdown file exactly at the limit', async () => {
    const atLimit = new Blob(['a'.repeat(MARKDOWN_PREVIEW_MAX_BYTES)])
    const { fileContent } = createFileContent(() => Promise.resolve(atLimit))

    const { result } = await renderViewer(fileContent, MARKDOWN)

    const state = result.current.state
    expect(state.status === 'markdown' && state.isTruncated).toBe(false)
  })

  it.each([
    ['a Word document', WORD.mimeType],
    ['a type the registry does not know', 'application/x-something-new'],
    ['a file with no known type', 'application/octet-stream'],
  ])(
    'does not read %s: it opens in another application, not on this page',
    async (_label, mimeType) => {
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(new Blob()),
      )

      const { result } = await renderViewer(
        fileContent,
        createTestFileResource({ mimeType }),
      )

      expect(result.current.state).toEqual({ status: 'unsupported' })
      expect(spies.load).not.toHaveBeenCalled()
    },
  )

  it('only ever reads: showing a file never saves, copies, or removes stored content', async () => {
    const { fileContent, spies } = createFileContent(() =>
      Promise.resolve(new Blob(['x'])),
    )

    await renderViewer(fileContent, PDF)
    await renderViewer(fileContent, MARKDOWN)
    await renderViewer(fileContent, WORD)

    expect(spies.saveHandle).not.toHaveBeenCalled()
    expect(spies.saveBlob).not.toHaveBeenCalled()
    expect(spies.remove).not.toHaveBeenCalled()
  })

  describe('when the file cannot be read', () => {
    it('explains a missing file and reports its code', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.reject(new FileContentError('NOT_FOUND', 'gone')),
      )

      const { result } = await renderViewer(fileContent, PDF)

      expect(result.current.state).toEqual({
        status: 'error',
        code: 'NOT_FOUND',
        message:
          '"Handbook" could not be found. It may have been moved, renamed, or deleted.',
      })
    })

    it('asks the user to allow access when permission was denied', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.reject(new FileContentError('PERMISSION_DENIED', 'no')),
      )

      const { result } = await renderViewer(fileContent, PDF)

      const state = result.current.state
      expect(state.status).toBe('error')
      if (state.status === 'error') {
        expect(state.code).toBe('PERMISSION_DENIED')
        expect(state.message).toContain('Try again')
      }
    })

    it('reports an unavailable file for a read failure it recognises', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.reject(new FileContentError('UNAVAILABLE', 'broken')),
      )

      const { result } = await renderViewer(fileContent, PDF)

      const state = result.current.state
      expect(state.status === 'error' && state.code).toBe('UNAVAILABLE')
    })

    it('treats an unexpected failure as unavailable and logs it', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      const { fileContent } = createFileContent(() =>
        Promise.reject(new Error('disk on fire')),
      )

      const { result } = await renderViewer(fileContent, PDF)

      const state = result.current.state
      expect(state.status === 'error' && state.code).toBe('UNAVAILABLE')
      expect(consoleError).toHaveBeenCalled()
    })

    it('does not put a low-level message in front of the user', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.reject(
          new FileContentError(
            'NOT_FOUND',
            'No file content is stored for resource "pdf-1".',
          ),
        ),
      )

      const { result } = await renderViewer(fileContent, PDF)

      const state = result.current.state
      expect(state.status === 'error' && state.message).not.toContain('pdf-1')
    })
  })

  describe('retry', () => {
    it('reads the file again, so a lapsed permission can be re-granted', async () => {
      const blob = new Blob(['%PDF'])
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(blob),
      )
      spies.load.mockRejectedValueOnce(
        new FileContentError('PERMISSION_DENIED', 'no'),
      )
      const { result } = await renderViewer(fileContent, PDF)
      expect(result.current.state.status).toBe('error')

      act(() => result.current.retry())
      expect(result.current.state).toEqual({ status: 'loading' })
      await act(async () => {
        await Promise.resolve()
      })

      expect(spies.load).toHaveBeenCalledTimes(2)
      expect(result.current.state).toEqual({ status: 'opening-document' })
      expect(replaceLocation).toHaveBeenCalledOnce()
    })

    it('shows the newest read when an earlier one finishes late', async () => {
      const first = deferred<Blob>()
      const second = deferred<Blob>()
      const { fileContent, spies } = createFileContent(() => first.promise)
      spies.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      const { result } = renderHook(() =>
        useFileViewer({ fileContent, resource: MARKDOWN, replaceLocation }),
      )

      act(() => result.current.retry())
      await act(async () => second.resolve(new Blob(['newer'])))
      await act(async () => first.resolve(new Blob(['older'])))

      expect(result.current.state).toEqual({
        status: 'markdown',
        text: 'newer',
        isTruncated: false,
      })
    })
  })

  it('does not read the file again when the collections change around it', async () => {
    const { fileContent, spies } = createFileContent(() =>
      Promise.resolve(new Blob(['%PDF'])),
    )
    const { rerender } = await renderViewer(fileContent, PDF)

    // The same file, as a fresh object — what another tab's edit hands back.
    rerender({ resource: { ...PDF, updatedAt: PDF.updatedAt + 1 } })
    await act(async () => {
      await Promise.resolve()
    })

    expect(spies.load).toHaveBeenCalledTimes(1)
  })
})
