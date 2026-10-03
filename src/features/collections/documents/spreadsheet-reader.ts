import { read, utils, type WorkSheet } from 'xlsx'
import { SPREADSHEET_MAX_COLUMNS, SPREADSHEET_MAX_ROWS } from './document-limits'
import type { Sheet, Workbook } from './spreadsheet.types'

/**
 * The first bytes of the two containers an Excel workbook comes in: a zip
 * (`.xlsx`) and an OLE compound file (`.xls`).
 */
const WORKBOOK_SIGNATURES: readonly (readonly number[])[] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
]

/**
 * Whether the bytes start like a workbook. The parsing library reads almost
 * anything — plain text becomes a one-column "workbook" — so a file that is
 * not one is turned away here rather than shown as nonsense.
 */
function looksLikeWorkbook(bytes: ArrayBuffer): boolean {
  const start = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8))

  return WORKBOOK_SIGNATURES.some(
    signature =>
      start.length >= signature.length &&
      signature.every((byte, index) => start[index] === byte),
  )
}

/** Whether a sheet is hidden in the workbook, as Excel would leave it out. */
function isHidden(hidden: number | undefined): boolean {
  return hidden !== undefined && hidden !== 0
}

/** The sheet's full size: `!fullref` when rows were cut short while reading, else `!ref`. */
function measure(sheet: WorkSheet): { rows: number; columns: number } {
  const reference = sheet['!fullref'] ?? sheet['!ref']

  if (!reference) {
    return { rows: 0, columns: 0 }
  }

  const range = utils.decode_range(reference)

  return {
    rows: range.e.r - range.s.r + 1,
    columns: range.e.c - range.s.c + 1,
  }
}

function toSheet(name: string, sheet: WorkSheet): Sheet {
  const size = measure(sheet)
  const columns = Math.min(size.columns, SPREADSHEET_MAX_COLUMNS)
  // `raw: false` gives each cell's displayed text (dates and numbers formatted
  // as the workbook formats them); `defval` fills empty cells so rows line up.
  const allRows = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
  })
  const rows = allRows.slice(0, SPREADSHEET_MAX_ROWS).map(row =>
    Array.from({ length: columns }, (_, index) => {
      const value = row[index]

      return value === undefined || value === null ? '' : String(value)
    }),
  )

  return {
    name,
    rows,
    totalRows: size.rows,
    totalColumns: size.columns,
    isTruncated:
      size.rows > SPREADSHEET_MAX_ROWS || size.columns > SPREADSHEET_MAX_COLUMNS,
  }
}

/**
 * Reads an Excel workbook (`.xlsx`, or a legacy `.xls`) into its visible
 * sheets' displayed text. The file is untrusted: formulas are not kept (only
 * their stored results), styles and macros are not read, and no more rows
 * than are shown are parsed.
 *
 * @throws when the bytes are not a workbook the reader understands.
 */
export function readWorkbook(bytes: ArrayBuffer): Workbook {
  if (!looksLikeWorkbook(bytes)) {
    throw new Error('Not an Excel workbook.')
  }

  const workbook = read(bytes, {
    type: 'array',
    // One more than is shown, so a sheet that was cut short is known to be.
    sheetRows: SPREADSHEET_MAX_ROWS + 1,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
  })
  const sheetInfo = workbook.Workbook?.Sheets ?? []

  return {
    sheets: workbook.SheetNames.flatMap((name, index) => {
      const sheet = workbook.Sheets[name]

      if (!sheet || isHidden(sheetInfo[index]?.Hidden)) {
        return []
      }

      return [toSheet(name, sheet)]
    }),
  }
}
