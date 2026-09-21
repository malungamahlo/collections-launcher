// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { createTestFileResource } from '../test/collection.fixtures'
import { useOpenFileResource } from './use-open-file-resource'

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

  return {
    fileContent: spies as unknown as FileContentAdapter,
    spies,
  }
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

describe('useOpenFileResource', () => {
  it('starts closed', () => {
    const { fileContent } = createFileContent(() => Promise.resolve(new Blob()))
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    expect(result.current.state).toEqual({ status: 'closed' })
  })

  it('shows a PDF through its bytes, chosen by the registry from the MIME type', async () => {
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    const { fileContent, spies } = createFileContent(() =>
      Promise.resolve(blob),
    )
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    await act(() => result.current.open(PDF))

    expect(spies.load).toHaveBeenCalledWith('pdf-1')
    expect(result.current.state).toEqual({
      status: 'pdf',
      resource: PDF,
      blob,
    })
  })

  it('reports loading while the file is being read', async () => {
    const pending = deferred<Blob>()
    const { fileContent } = createFileContent(() => pending.promise)
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    let opening!: Promise<void>
    act(() => {
      opening = result.current.open(PDF)
    })

    expect(result.current.state).toEqual({ status: 'loading', resource: PDF })

    await act(async () => {
      pending.resolve(new Blob(['%PDF']))
      await opening
    })

    expect(result.current.state.status).toBe('pdf')
  })

  it('reads a Markdown file as text', async () => {
    const { fileContent } = createFileContent(() =>
      Promise.resolve(new Blob(['# Title\n\nBody'], { type: 'text/markdown' })),
    )
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    await act(() => result.current.open(MARKDOWN))

    expect(result.current.state).toEqual({
      status: 'markdown',
      resource: MARKDOWN,
      text: '# Title\n\nBody',
      isTruncated: false,
    })
  })

  it('renders only the start of a Markdown file larger than the preview limit', async () => {
    const oversized = new Blob(['a'.repeat(MARKDOWN_PREVIEW_MAX_BYTES + 500)])
    const { fileContent } = createFileContent(() => Promise.resolve(oversized))
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    await act(() => result.current.open(MARKDOWN))

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
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    await act(() => result.current.open(MARKDOWN))

    const state = result.current.state
    expect(state.status === 'markdown' && state.isTruncated).toBe(false)
  })

  it.each([
    ['a Word document', WORD.mimeType],
    ['a type the registry does not know', 'application/x-something-new'],
    ['a file with no known type', 'application/octet-stream'],
  ])(
    'does not read or preview %s: it is unsupported and nothing is touched',
    async (_label, mimeType) => {
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(new Blob()),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))
      const resource = createTestFileResource({ mimeType })

      await act(() => result.current.open(resource))

      expect(result.current.state).toEqual({ status: 'unsupported', resource })
      expect(spies.load).not.toHaveBeenCalled()
    },
  )

  it('only ever reads: opening never saves, copies, or removes stored content', async () => {
    const { fileContent, spies } = createFileContent(() =>
      Promise.resolve(new Blob(['x'])),
    )
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    await act(() => result.current.open(PDF))
    await act(() => result.current.open(MARKDOWN))
    await act(() => result.current.open(WORD))
    act(() => result.current.close())

    expect(spies.saveHandle).not.toHaveBeenCalled()
    expect(spies.saveBlob).not.toHaveBeenCalled()
    expect(spies.remove).not.toHaveBeenCalled()
  })

  describe('when the file cannot be read', () => {
    it('explains a missing file and reports its code', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.reject(new FileContentError('NOT_FOUND', 'gone')),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))

      expect(result.current.state).toEqual({
        status: 'error',
        resource: PDF,
        code: 'NOT_FOUND',
        message:
          '"Handbook" could not be found. It may have been moved, renamed, or deleted.',
      })
    })

    it('asks the user to allow access when permission was denied', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.reject(new FileContentError('PERMISSION_DENIED', 'no')),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))

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
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))

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
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))

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
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))

      const state = result.current.state
      expect(state.status === 'error' && state.message).not.toContain('pdf-1')
    })
  })

  describe('retry', () => {
    it('reads the same file again, so a lapsed permission can be re-granted', async () => {
      const blob = new Blob(['%PDF'])
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(blob),
      )
      spies.load.mockRejectedValueOnce(
        new FileContentError('PERMISSION_DENIED', 'no'),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))
      expect(result.current.state.status).toBe('error')

      await act(async () => {
        result.current.retry()
        // The retry starts its own read; let it finish.
        await Promise.resolve()
      })

      expect(spies.load).toHaveBeenCalledTimes(2)
      expect(result.current.state).toEqual({
        status: 'pdf',
        resource: PDF,
        blob,
      })
    })

    it('does nothing when no file is open', () => {
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(new Blob()),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      act(() => result.current.retry())

      expect(spies.load).not.toHaveBeenCalled()
      expect(result.current.state).toEqual({ status: 'closed' })
    })

    it('does nothing after the viewer was closed', async () => {
      const { fileContent, spies } = createFileContent(() =>
        Promise.resolve(new Blob(['%PDF'])),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))
      act(() => result.current.close())
      act(() => result.current.retry())

      expect(spies.load).toHaveBeenCalledTimes(1)
      expect(result.current.state).toEqual({ status: 'closed' })
    })
  })

  describe('close', () => {
    it('closes the viewer', async () => {
      const { fileContent } = createFileContent(() =>
        Promise.resolve(new Blob(['%PDF'])),
      )
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      await act(() => result.current.open(PDF))
      act(() => result.current.close())

      expect(result.current.state).toEqual({ status: 'closed' })
    })

    it('discards a read that finishes after the viewer was closed', async () => {
      const pending = deferred<Blob>()
      const { fileContent } = createFileContent(() => pending.promise)
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      let opening!: Promise<void>
      act(() => {
        opening = result.current.open(PDF)
      })
      act(() => result.current.close())

      await act(async () => {
        pending.resolve(new Blob(['%PDF']))
        await opening
      })

      expect(result.current.state).toEqual({ status: 'closed' })
    })

    it('discards a failure that arrives after the viewer was closed', async () => {
      const pending = deferred<Blob>()
      const { fileContent } = createFileContent(() => pending.promise)
      const { result } = renderHook(() => useOpenFileResource({ fileContent }))

      let opening!: Promise<void>
      act(() => {
        opening = result.current.open(PDF)
      })
      act(() => result.current.close())

      await act(async () => {
        pending.reject(new FileContentError('NOT_FOUND', 'gone'))
        await opening
      })

      expect(result.current.state).toEqual({ status: 'closed' })
    })
  })

  it('shows the file opened last when an earlier read finishes late', async () => {
    const slowPdf = deferred<Blob>()
    const { fileContent } = createFileContent(id =>
      id === 'pdf-1'
        ? slowPdf.promise
        : Promise.resolve(new Blob(['# Fast'])),
    )
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    let openingPdf!: Promise<void>
    act(() => {
      openingPdf = result.current.open(PDF)
    })
    await act(() => result.current.open(MARKDOWN))

    await act(async () => {
      slowPdf.resolve(new Blob(['%PDF']))
      await openingPdf
    })

    expect(result.current.state).toEqual({
      status: 'markdown',
      resource: MARKDOWN,
      text: '# Fast',
      isTruncated: false,
    })
  })

  it('lets an unsupported file replace one that is still loading', async () => {
    const pending = deferred<Blob>()
    const { fileContent } = createFileContent(() => pending.promise)
    const { result } = renderHook(() => useOpenFileResource({ fileContent }))

    let opening!: Promise<void>
    act(() => {
      opening = result.current.open(PDF)
    })
    await act(() => result.current.open(WORD))

    await act(async () => {
      pending.resolve(new Blob(['%PDF']))
      await opening
    })

    expect(result.current.state).toEqual({ status: 'unsupported', resource: WORD })
  })
})
