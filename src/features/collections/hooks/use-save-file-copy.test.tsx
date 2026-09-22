// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import { createTestFileResource } from '../test/collection.fixtures'
import { useSaveFileCopy } from './use-save-file-copy'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const HANDBOOK = createTestFileResource({
  id: 'pdf-1',
  name: 'Handbook',
  mimeType: 'application/pdf',
})

function createAdapters(load: () => Promise<Blob>) {
  const fileContent = {
    load: vi.fn(load),
    saveHandle: vi.fn(),
    saveBlob: vi.fn(),
    remove: vi.fn(),
  }
  const download = vi.fn<FileDownloadAdapter['download']>()

  return {
    fileContent: fileContent as unknown as FileContentAdapter,
    fileContentSpies: fileContent,
    fileDownload: { download } satisfies FileDownloadAdapter,
    download,
  }
}

describe('useSaveFileCopy', () => {
  it("downloads the file's own content, named after the resource with its extension", async () => {
    const content = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    const adapters = createAdapters(() => Promise.resolve(content))
    const { result } = renderHook(() => useSaveFileCopy(adapters))

    await act(() => result.current.save(HANDBOOK))

    expect(adapters.fileContentSpies.load).toHaveBeenCalledWith('pdf-1')
    expect(adapters.download).toHaveBeenCalledExactlyOnceWith(
      'Handbook.pdf',
      content,
    )
    expect(result.current.error).toBeUndefined()
  })

  it('only reads: saving a copy never stores, copies, or removes stored content', async () => {
    const adapters = createAdapters(() => Promise.resolve(new Blob(['x'])))
    const { result } = renderHook(() => useSaveFileCopy(adapters))

    await act(() => result.current.save(HANDBOOK))

    expect(adapters.fileContentSpies.saveHandle).not.toHaveBeenCalled()
    expect(adapters.fileContentSpies.saveBlob).not.toHaveBeenCalled()
    expect(adapters.fileContentSpies.remove).not.toHaveBeenCalled()
  })

  it.each([
    ['NOT_FOUND', 'nothing to save'],
    ['PERMISSION_DENIED', 'Save a copy again'],
    ['UNAVAILABLE', 'could not be saved'],
  ] as const)('explains a %s failure and downloads nothing', async (code, text) => {
    const adapters = createAdapters(() =>
      Promise.reject(new FileContentError(code, 'internal message')),
    )
    const { result } = renderHook(() => useSaveFileCopy(adapters))

    await act(() => result.current.save(HANDBOOK))

    expect(result.current.error).toContain('"Handbook"')
    expect(result.current.error).toContain(text)
    expect(result.current.error).not.toContain('internal message')
    expect(adapters.download).not.toHaveBeenCalled()
  })

  it('treats an unexpected failure as unavailable and logs it', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const adapters = createAdapters(() => Promise.reject(new Error('boom')))
    const { result } = renderHook(() => useSaveFileCopy(adapters))

    await act(() => result.current.save(HANDBOOK))

    expect(result.current.error).toContain('could not be saved')
    expect(consoleError).toHaveBeenCalled()
  })

  it('clears an earlier error when the next attempt starts, and on request', async () => {
    const adapters = createAdapters(() => Promise.resolve(new Blob(['x'])))
    adapters.fileContentSpies.load.mockRejectedValueOnce(
      new FileContentError('UNAVAILABLE', 'x'),
    )
    const { result } = renderHook(() => useSaveFileCopy(adapters))

    await act(() => result.current.save(HANDBOOK))
    expect(result.current.error).toBeDefined()

    await act(() => result.current.save(HANDBOOK))
    expect(result.current.error).toBeUndefined()

    adapters.fileContentSpies.load.mockRejectedValueOnce(
      new FileContentError('UNAVAILABLE', 'x'),
    )
    await act(() => result.current.save(HANDBOOK))
    act(() => result.current.clearError())
    expect(result.current.error).toBeUndefined()
  })
})
