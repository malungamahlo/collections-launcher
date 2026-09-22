import { describe, expect, it } from 'vitest'
import { getFileResourceFileName, toSafeFileName } from './file-name'
import { createTestFileResource } from '../test/collection.fixtures'

describe('toSafeFileName', () => {
  it('leaves an ordinary name alone', () => {
    expect(toSafeFileName('Employee handbook')).toBe('Employee handbook')
  })

  it.each([
    ['Q3: plan', 'Q3_ plan'],
    ['a/b\\c', 'a_b_c'],
    ['what?*"<>|', 'what______'],
    ['tab\there', 'tab_here'],
    ['line\nbreak', 'line_break'],
  ])('replaces characters a file system rejects: %j -> %j', (input, expected) => {
    expect(toSafeFileName(input)).toBe(expected)
  })

  it('drops trailing dots and spaces, which Windows refuses', () => {
    expect(toSafeFileName('Report. . ')).toBe('Report')
  })

  it('keeps dots inside a name', () => {
    expect(toSafeFileName('v1.2 notes')).toBe('v1.2 notes')
  })

  it('falls back to "file" when nothing usable is left', () => {
    expect(toSafeFileName('...')).toBe('file')
    expect(toSafeFileName('   ')).toBe('file')
    expect(toSafeFileName('')).toBe('file')
  })

  it('cuts a very long name', () => {
    expect(toSafeFileName('a'.repeat(300))).toHaveLength(100)
  })
})

describe('getFileResourceFileName', () => {
  it.each([
    ['application/pdf', 'Handbook.pdf'],
    ['text/markdown', 'Handbook.md'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Handbook.docx',
    ],
    ['application/msword', 'Handbook.doc'],
    ['application/vnd.ms-excel', 'Handbook.xls'],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Handbook.pptx',
    ],
  ])('adds the extension for %s', (mimeType, expected) => {
    expect(
      getFileResourceFileName(
        createTestFileResource({ name: 'Handbook', mimeType }),
      ),
    ).toBe(expected)
  })

  it('does not repeat an extension the name already ends with, whatever its case', () => {
    expect(
      getFileResourceFileName(
        createTestFileResource({ name: 'Handbook.PDF', mimeType: 'application/pdf' }),
      ),
    ).toBe('Handbook.PDF')
  })

  it('adds no extension for a type the registry does not list', () => {
    expect(
      getFileResourceFileName(
        createTestFileResource({
          name: 'Mystery',
          mimeType: 'application/x-something-new',
        }),
      ),
    ).toBe('Mystery')
  })

  it('makes the name safe as well', () => {
    expect(
      getFileResourceFileName(
        createTestFileResource({ name: 'Q3: plan', mimeType: 'application/pdf' }),
      ),
    ).toBe('Q3_ plan.pdf')
  })
})
