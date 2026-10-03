import { utils, write } from 'xlsx'
import { describe, expect, it } from 'vitest'
import { SPREADSHEET_MAX_COLUMNS, SPREADSHEET_MAX_ROWS } from './document-limits'
import { readWorkbook } from './spreadsheet-reader'

type BookType = 'xlsx' | 'biff8'

/** Writes a workbook in memory the way Excel would save one. */
function toFile(book: ReturnType<typeof utils.book_new>, bookType: BookType = 'xlsx'): ArrayBuffer {
  return write(book, { type: 'array', bookType }) as ArrayBuffer
}

/** Builds a real workbook file from rows of values, one sheet per entry. */
function workbookFile(
  sheets: Record<string, unknown[][]>,
  options: { hidden?: readonly string[]; bookType?: BookType } = {},
): ArrayBuffer {
  const book = utils.book_new()

  for (const [name, rows] of Object.entries(sheets)) {
    utils.book_append_sheet(book, utils.aoa_to_sheet(rows), name)
  }

  if (options.hidden) {
    book.Workbook = {
      Sheets: Object.keys(sheets).map(name => ({
        name,
        Hidden: options.hidden?.includes(name) ? 1 : 0,
      })),
    }
  }

  return toFile(book, options.bookType)
}

describe('readWorkbook', () => {
  it('reads every sheet, in order, as displayed text', () => {
    const workbook = readWorkbook(
      workbookFile({
        Orders: [
          ['Order', 'Amount'],
          ['A-1', 12.5],
        ],
        People: [['Name'], ['Ann']],
      }),
    )

    expect(workbook.sheets.map(sheet => sheet.name)).toEqual(['Orders', 'People'])
    expect(workbook.sheets[0]?.rows).toEqual([
      ['Order', 'Amount'],
      ['A-1', '12.5'],
    ])
    expect(workbook.sheets[0]).toMatchObject({
      totalRows: 2,
      totalColumns: 2,
      isTruncated: false,
    })
  })

  it('reads a legacy .xls workbook too', () => {
    const workbook = readWorkbook(
      workbookFile({ Old: [['Region'], ['West']] }, { bookType: 'biff8' }),
    )

    expect(workbook.sheets[0]?.rows).toEqual([['Region'], ['West']])
  })

  it('fills empty cells so every row lines up', () => {
    const workbook = readWorkbook(workbookFile({ S: [['a', null, 'c'], ['d']] }))

    expect(workbook.sheets[0]?.rows).toEqual([
      ['a', '', 'c'],
      ['d', '', ''],
    ])
  })

  it('shows a formula’s stored result, never the formula', () => {
    const book = utils.book_new()
    const sheet = utils.aoa_to_sheet([[1, 2]])
    sheet.C1 = { t: 'n', v: 3, f: 'A1+B1' }
    sheet['!ref'] = 'A1:C1'
    utils.book_append_sheet(book, sheet, 'S')

    const workbook = readWorkbook(toFile(book))

    expect(workbook.sheets[0]?.rows).toEqual([['1', '2', '3']])
  })

  it('leaves out a sheet the workbook hides', () => {
    const workbook = readWorkbook(
      workbookFile({ Shown: [['x']], Secret: [['y']] }, { hidden: ['Secret'] }),
    )

    expect(workbook.sheets.map(sheet => sheet.name)).toEqual(['Shown'])
  })

  it('shows only the first rows of a very long sheet, and says it is cut short', () => {
    const rows = Array.from({ length: SPREADSHEET_MAX_ROWS + 50 }, (_, index) => [index])

    const [sheet] = readWorkbook(workbookFile({ Long: rows })).sheets

    expect(sheet?.rows).toHaveLength(SPREADSHEET_MAX_ROWS)
    expect(sheet?.totalRows).toBe(SPREADSHEET_MAX_ROWS + 50)
    expect(sheet?.isTruncated).toBe(true)
  })

  it('shows only the first columns of a very wide sheet', () => {
    const row = Array.from({ length: SPREADSHEET_MAX_COLUMNS + 5 }, (_, index) => index)

    const [sheet] = readWorkbook(workbookFile({ Wide: [row] })).sheets

    expect(sheet?.rows[0]).toHaveLength(SPREADSHEET_MAX_COLUMNS)
    expect(sheet?.totalColumns).toBe(SPREADSHEET_MAX_COLUMNS + 5)
    expect(sheet?.isTruncated).toBe(true)
  })

  it('reads an empty sheet as having nothing to show', () => {
    const book = utils.book_new()
    utils.book_append_sheet(book, utils.aoa_to_sheet([]), 'Empty')

    const [sheet] = readWorkbook(toFile(book)).sheets

    expect(sheet).toMatchObject({ rows: [], totalRows: 0, isTruncated: false })
  })

  it('keeps cell text as text, however much it looks like markup', () => {
    const [sheet] = readWorkbook(
      workbookFile({ S: [['<img src=x onerror=alert(1)>']] }),
    ).sheets

    expect(sheet?.rows[0]?.[0]).toBe('<img src=x onerror=alert(1)>')
  })

  it('rejects bytes that are not a workbook', () => {
    expect(() =>
      readWorkbook(new TextEncoder().encode('%PDF-1.7 not a workbook').buffer),
    ).toThrow()
  })
})
