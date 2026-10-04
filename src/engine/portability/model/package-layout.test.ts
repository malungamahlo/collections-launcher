import { describe, expect, it } from 'vitest'
import { buildAttachmentPath, isValidAttachmentPath } from './package-layout'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('buildAttachmentPath', () => {
  it.each([
    [1, 'application/pdf', 'attachments/0001.pdf'],
    [2, DOCX, 'attachments/0002.docx'],
    [37, 'text/markdown', 'attachments/0037.md'],
    [1000, 'application/vnd.ms-excel', 'attachments/1000.xls'],
  ])('names attachment %i of type %s "%s"', (position, mimeType, path) => {
    expect(buildAttachmentPath(position, mimeType)).toBe(path)
  })

  it('gives a file of a type the registry does not know a neutral extension', () => {
    expect(buildAttachmentPath(3, 'application/x-something-new')).toBe('attachments/0003.bin')
    expect(buildAttachmentPath(4, '')).toBe('attachments/0004.bin')
  })

  it('always writes a path it would itself accept', () => {
    for (const mimeType of ['application/pdf', DOCX, 'text/markdown', 'application/x-unknown']) {
      expect(isValidAttachmentPath(buildAttachmentPath(1, mimeType))).toBe(true)
      expect(isValidAttachmentPath(buildAttachmentPath(9999, mimeType))).toBe(true)
    }
  })

  it.each([[0], [-1], [1.5], [10_000], [Number.NaN]])(
    'refuses the position %s',
    position => {
      expect(() => buildAttachmentPath(position, 'application/pdf')).toThrow(RangeError)
    },
  )
})

describe('isValidAttachmentPath', () => {
  it.each([['attachments/0001.pdf'], ['attachments/9999.docx'], ['attachments/0042.bin']])(
    'accepts %s',
    path => {
      expect(isValidAttachmentPath(path)).toBe(true)
    },
  )

  it.each([
    ['a parent folder', 'attachments/../0001.pdf'],
    ['a climb out of the package', '../attachments/0001.pdf'],
    ['an absolute path', '/attachments/0001.pdf'],
    ['a Windows drive', 'C:\\attachments\\0001.pdf'],
    ['a backslash', 'attachments\\0001.pdf'],
    ['a nested folder', 'attachments/more/0001.pdf'],
    ['another folder', 'other/0001.pdf'],
    ['no folder', '0001.pdf'],
    ['a name that is not four digits', 'attachments/1.pdf'],
    ['five digits', 'attachments/00001.pdf'],
    ['a user file name', 'attachments/My report.pdf'],
    ['an upper-case extension', 'attachments/0001.PDF'],
    ['an over-long extension', 'attachments/0001.abcdefghi'],
    ['no extension', 'attachments/0001'],
    ['two extensions', 'attachments/0001.pdf.exe'],
    ['a trailing newline', 'attachments/0001.pdf\n'],
    ['a NUL byte', 'attachments/0001.pdf\u0000'],
    ['the manifest', 'manifest.json'],
    ['nothing', ''],
  ])('refuses %s', (_label, path) => {
    expect(isValidAttachmentPath(path)).toBe(false)
  })
})
