import { describe, expect, it } from 'vitest'
import {
  buildFileDocumentUrl,
  readFileDocumentResourceId,
} from './file-document-location'

describe('file document location', () => {
  it('ends in the file name, after the resource id', () => {
    expect(buildFileDocumentUrl('abc-123', 'Handbook.pdf')).toBe(
      '/file/abc-123/Handbook.pdf',
    )
  })

  it.each([
    ['spaces', 'Design for application protection.pdf'],
    ['a hash and a question mark', 'Q#1 what?.pdf'],
    ['a slash-free unicode name', 'Résumé – 2026 ✓.pdf'],
  ])('keeps a name with %s inside one path segment', (_label, fileName) => {
    const url = new URL(
      buildFileDocumentUrl('abc-123', fileName),
      'chrome-extension://x/',
    )

    expect(url.search).toBe('')
    expect(url.hash).toBe('')
    expect(decodeURIComponent(url.pathname.split('/').at(-1) ?? '')).toBe(fileName)
    expect(readFileDocumentResourceId(url.pathname)).toBe('abc-123')
  })

  it('round-trips an id that needs escaping', () => {
    const id = 'a b&c=d/é?#'
    const url = new URL(buildFileDocumentUrl(id, 'x.pdf'), 'chrome-extension://x/')

    expect(readFileDocumentResourceId(url.pathname)).toBe(id)
  })

  it.each([
    ['/viewer.html'],
    ['/file/'],
    ['/file/abc'],
    ['/file/abc/'],
    ['/file/abc/x.pdf/more'],
    ['/file/%E0%A4%A/x.pdf'],
    ['/files/abc/x.pdf'],
  ])('reads no resource from %j', pathname => {
    expect(readFileDocumentResourceId(pathname)).toBeUndefined()
  })
})
