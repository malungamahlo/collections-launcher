import { useState } from 'react'
import { cn } from '@app/shared/lib/utils'
import {
  SPREADSHEET_MAX_COLUMNS,
  SPREADSHEET_MAX_ROWS,
} from '../documents/document-limits'
import { columnName } from '../documents/column-name'
import type { Sheet, Workbook } from '../documents/spreadsheet.types'

function truncationNote(sheet: Sheet): string {
  const parts: string[] = []

  if (sheet.totalRows > SPREADSHEET_MAX_ROWS) {
    parts.push(`the first ${SPREADSHEET_MAX_ROWS.toLocaleString()} of ${sheet.totalRows.toLocaleString()} rows`)
  }

  if (sheet.totalColumns > SPREADSHEET_MAX_COLUMNS) {
    parts.push(`the first ${SPREADSHEET_MAX_COLUMNS} of ${sheet.totalColumns} columns`)
  }

  return `This sheet is large, so only ${parts.join(' and ')} are shown.`
}

function SheetTable({ sheet }: { readonly sheet: Sheet }) {
  const columnCount = sheet.rows[0]?.length ?? 0

  if (sheet.rows.length === 0) {
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        This sheet is empty.
      </p>
    )
  }

  return (
    <table className="border-separate border-spacing-0 bg-white text-[13px] text-slate-900">
      <thead>
        <tr>
          <th className="sticky left-0 top-0 z-20 border-b border-r border-slate-300 bg-slate-100" />
          {Array.from({ length: columnCount }, (_, index) => (
            <th
              key={index}
              scope="col"
              className="sticky top-0 z-10 min-w-16 border-b border-r border-slate-300 bg-slate-100 px-2 py-1 text-center font-normal text-slate-600"
            >
              {columnName(index)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <th
              scope="row"
              className="sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-100 px-2 py-1 text-right font-normal text-slate-600"
            >
              {rowIndex + 1}
            </th>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className="max-w-80 truncate whitespace-nowrap border-b border-r border-slate-200 px-2 py-1"
                title={cell.length > 40 ? cell : undefined}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Shows a workbook the way a spreadsheet application does: the current
 * sheet's grid, with column letters and row numbers that stay in view while
 * it scrolls, and a tab for each sheet along the bottom. Read-only; cells are
 * shown as text, never as markup.
 */
export function SpreadsheetView({ workbook }: { readonly workbook: Workbook }) {
  const [selected, setSelected] = useState(0)
  const sheet = workbook.sheets[selected]

  if (!sheet) {
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        This workbook has no sheets to show.
      </p>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {sheet.isTruncated && (
        <p role="status" className="shrink-0 bg-muted px-4 py-2 text-sm text-muted-foreground">
          {truncationNote(sheet)}
        </p>
      )}

      <div
        role="tabpanel"
        aria-label={sheet.name}
        className="min-h-0 flex-1 overflow-auto"
      >
        <SheetTable sheet={sheet} />
      </div>

      {workbook.sheets.length > 0 && (
        <div
          role="tablist"
          aria-label="Sheets"
          className="flex shrink-0 gap-1 overflow-x-auto border-t border-slate-300 bg-slate-100 px-2 py-1"
        >
          {workbook.sheets.map((candidate, index) => (
            <button
              key={`${candidate.name}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === selected}
              onClick={() => setSelected(index)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                index === selected
                  ? 'bg-white font-medium text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200',
              )}
            >
              {candidate.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
