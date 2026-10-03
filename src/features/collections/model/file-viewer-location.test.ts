import { describe, expect, it } from 'vitest'
import {
  buildFileViewerUrl,
  FILE_VIEWER_PAGE_PATH,
  readFileDocumentUnavailable,
  readFileViewerResourceId,
} from './file-viewer-location'

describe('file viewer location', () => {
  it('points at the viewer page with the resource in its query string', () => {
    expect(buildFileViewerUrl('abc-123')).toBe('/viewer.html?resource=abc-123')
    expect(FILE_VIEWER_PAGE_PATH).toBe('/viewer.html')
  })

  it('reads back the id it built', () => {
    const url = new URL(buildFileViewerUrl('abc-123'), 'chrome-extension://x/')

    expect(readFileViewerResourceId(url.search)).toBe('abc-123')
  })

  it('round-trips an id that needs escaping', () => {
    const id = 'a b&c=d/é?#'
    const url = new URL(buildFileViewerUrl(id), 'chrome-extension://x/')

    expect(readFileViewerResourceId(url.search)).toBe(id)
  })

  it.each([[''], ['?'], ['?other=1'], ['?resource=']])(
    'reads no resource from %j',
    search => {
      expect(readFileViewerResourceId(search)).toBeUndefined()
    },
  )
})

describe('file viewer location after a document could not be served', () => {
  it('says so in the address, and reads it back', () => {
    const url = buildFileViewerUrl('abc-123', { documentUnavailable: true })

    expect(url).toBe('/viewer.html?resource=abc-123&document=unavailable')
    expect(readFileDocumentUnavailable(new URL(url, 'chrome-extension://x/').search)).toBe(true)
    expect(readFileViewerResourceId(new URL(url, 'chrome-extension://x/').search)).toBe('abc-123')
  })

  it.each([[''], ['?resource=abc'], ['?resource=abc&document=other']])(
    'is not set in %j',
    search => {
      expect(readFileDocumentUnavailable(search)).toBe(false)
    },
  )
})
