import { describe, expect, it } from 'vitest'
import {
  buildFileViewerUrl,
  FILE_VIEWER_PAGE_PATH,
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
