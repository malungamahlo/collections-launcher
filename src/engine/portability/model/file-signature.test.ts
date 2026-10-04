import { describe, expect, it } from 'vitest'
import { RESOURCE_KINDS } from '@app/features/collections/model/resource-kind-registry'
import { looksLikeDeclaredType, SIGNATURE_SAMPLE_BYTES } from './file-signature'

const text = (value: string) => new TextEncoder().encode(value)
const bytes = (...values: number[]) => new Uint8Array(values)

const PDF_START = text('%PDF-1.7\n')
const ZIP_START = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00)
const OLE_START = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00)
const HTML = text('<!doctype html><script>alert(1)</script>')

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

describe('looksLikeDeclaredType', () => {
  it.each([
    ['a PDF', 'application/pdf', PDF_START],
    ['a Word document', DOCX, ZIP_START],
    ['an Excel workbook', XLSX, ZIP_START],
    ['a PowerPoint presentation', PPTX, ZIP_START],
    ['a legacy Word document', 'application/msword', OLE_START],
    ['a legacy Excel workbook', 'application/vnd.ms-excel', OLE_START],
    ['a legacy PowerPoint presentation', 'application/vnd.ms-powerpoint', OLE_START],
    ['a Markdown file', 'text/markdown', text('# Notes\n\nBody — with ünïcödé.')],
    ['an empty Markdown file', 'text/markdown', new Uint8Array()],
  ])('accepts %s that starts as one should', (_label, mimeType, sample) => {
    expect(looksLikeDeclaredType(mimeType, sample)).toBe(true)
  })

  it.each([
    ['an HTML page declared as a PDF', 'application/pdf', HTML],
    ['a zip declared as a PDF', 'application/pdf', ZIP_START],
    ['an empty file declared as a PDF', 'application/pdf', new Uint8Array()],
    ['a PDF declared as a Word document', DOCX, PDF_START],
    ['a legacy file declared as a current Word document', DOCX, OLE_START],
    ['a current file declared as a legacy Word document', 'application/msword', ZIP_START],
    ['text declared as an Excel workbook', XLSX, text('a,b,c\n1,2,3')],
    ['a signature cut short', PPTX, bytes(0x50, 0x4b)],
    ['a binary file declared as Markdown', 'text/markdown', bytes(0x23, 0x20, 0x00, 0x41)],
  ])('refuses %s', (_label, mimeType, sample) => {
    expect(looksLikeDeclaredType(mimeType, sample)).toBe(false)
  })

  it('ignores case and parameters in the declared type', () => {
    expect(looksLikeDeclaredType('Application/PDF; charset=binary', HTML)).toBe(false)
    expect(looksLikeDeclaredType('Application/PDF', PDF_START)).toBe(true)
  })

  it('does not check a type the registry does not know: it is never shown in the browser', () => {
    expect(looksLikeDeclaredType('application/x-something-new', HTML)).toBe(true)
    expect(looksLikeDeclaredType('application/octet-stream', bytes(0, 1, 2))).toBe(true)
  })

  it('only looks at the start of a Markdown file for a NUL byte', () => {
    const late = new Uint8Array(SIGNATURE_SAMPLE_BYTES + 10).fill(0x61)
    late[SIGNATURE_SAMPLE_BYTES + 5] = 0

    expect(looksLikeDeclaredType('text/markdown', late)).toBe(true)
  })

  it('has a rule for every format the registry can show or open', () => {
    // A format added to the registry without a rule here would be imported unchecked.
    const html = HTML

    for (const format of RESOURCE_KINDS.flatMap(kind => kind.formats)) {
      const isText = format.extensions.includes('.md')

      expect(looksLikeDeclaredType(format.mimeType, html), format.mimeType).toBe(isText)
    }
  })
})
