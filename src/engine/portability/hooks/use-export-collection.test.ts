// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import { useExportCollection } from './use-export-collection'
import { bundleFileName } from '../model/bundle-file'
import { createSingleResourceTestCollection } from '../test/portability.fixtures'

afterEach(() => {
  cleanup()
})

describe('useExportCollection', () => {
  it('downloads a serialized bundle named after the collection', () => {
    const download = vi.fn()
    const adapter: FileDownloadAdapter = { download }
    const collection = createSingleResourceTestCollection()
    const { result } = renderHook(() => useExportCollection(adapter))

    act(() => {
      result.current.exportCollection(collection)
    })

    expect(download).toHaveBeenCalledOnce()
    const [fileName, contents] = download.mock.calls[0] as [string, string]
    expect(fileName).toBe(bundleFileName(collection.name))
    expect(JSON.parse(contents).collection.name).toBe(collection.name)
    expect(result.current.error).toBeUndefined()
  })

  it('sets an error message and does not throw when the download adapter fails', () => {
    const download = vi.fn(() => {
      throw new Error('boom')
    })
    const adapter: FileDownloadAdapter = { download }
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() => useExportCollection(adapter))

    act(() => {
      result.current.exportCollection(createSingleResourceTestCollection())
    })

    expect(result.current.error).toBe(
      'The collection could not be exported. Try again.',
    )
    expect(consoleError).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
