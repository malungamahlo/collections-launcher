// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserFileDownloadAdapter } from './file-download.adapter'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('BrowserFileDownloadAdapter', () => {
  it('downloads the given contents through an object-URL anchor click', () => {
    const objectUrl = 'blob:mock-url'
    const createObjectURL = vi.fn().mockReturnValue(objectUrl)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

    let capturedAnchor: HTMLAnchorElement | undefined
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string) => {
        const element = originalCreateElement(tagName)

        if (tagName === 'a') {
          capturedAnchor = element as HTMLAnchorElement
          vi.spyOn(capturedAnchor, 'click').mockImplementation(
            () => undefined,
          )
        }

        return element
      },
    )

    new BrowserFileDownloadAdapter().download(
      'My Collection.collectionLauncher',
      '{"a":1}',
    )

    expect(createObjectURL).toHaveBeenCalledOnce()
    const [blob] = createObjectURL.mock.calls[0] as [Blob]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
    expect(capturedAnchor?.href).toBe(objectUrl)
    expect(capturedAnchor?.download).toBe('My Collection.collectionLauncher')
    expect(capturedAnchor?.click).toHaveBeenCalledOnce()
  })

  it('revokes the object URL after the click has been processed', () => {
    vi.useFakeTimers()
    const objectUrl = 'blob:mock-url'
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue(objectUrl),
      revokeObjectURL,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    )

    new BrowserFileDownloadAdapter().download('file.collectionLauncher', '{}')

    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl)
  })
})
