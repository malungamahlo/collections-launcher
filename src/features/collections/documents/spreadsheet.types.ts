/**
 * A workbook as this app shows it: every visible sheet's cells as the text
 * Excel would display, never formulas, styles, or anything that could run.
 * A plain data shape — the reader maps the parsing library's own types into
 * it, so nothing about that library reaches the view.
 */
export interface Workbook {
  readonly sheets: readonly Sheet[]
}

export interface Sheet {
  readonly name: string
  /** The rows shown, each padded to the same number of cells. */
  readonly rows: readonly (readonly string[])[]
  /** How many rows and columns the sheet really has, shown or not. */
  readonly totalRows: number
  readonly totalColumns: number
  /** True when only part of the sheet is shown (see the reader's limits). */
  readonly isTruncated: boolean
}
