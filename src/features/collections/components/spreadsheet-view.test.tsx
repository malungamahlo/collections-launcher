// @vitest-environment happy-dom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { columnName } from '../documents/column-name'
import type { Sheet, Workbook } from '../documents/spreadsheet.types'
import { SpreadsheetView } from './spreadsheet-view'

afterEach(() => {
  cleanup()
})

function sheet(name: string, rows: string[][], extra: Partial<Sheet> = {}): Sheet {
  return {
    name,
    rows,
    totalRows: rows.length,
    totalColumns: rows[0]?.length ?? 0,
    isTruncated: false,
    ...extra,
  }
}

const WORKBOOK: Workbook = {
  sheets: [
    sheet('Orders', [
      ['Order', 'Amount'],
      ['A-1', '12.50'],
    ]),
    sheet('People', [['Name'], ['Ann']]),
  ],
}

describe('columnName', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('names column %i "%s", as Excel does', (index, name) => {
    expect(columnName(index)).toBe(name)
  })
})

describe('SpreadsheetView', () => {
  it('shows the first sheet’s cells, with column letters and row numbers', () => {
    render(<SpreadsheetView workbook={WORKBOOK} />)

    const grid = screen.getByRole('tabpanel', { name: 'Orders' })
    expect(within(grid).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
      '',
      'A',
      'B',
    ])
    expect(within(grid).getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['1', '2'])
    expect(within(grid).getByText('12.50')).not.toBeNull()
  })

  it('has a tab for each sheet, and shows the one chosen', async () => {
    const user = userEvent.setup()
    render(<SpreadsheetView workbook={WORKBOOK} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(tab => tab.textContent)).toEqual(['Orders', 'People'])
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')

    await user.click(screen.getByRole('tab', { name: 'People' }))

    expect(screen.getByRole('tabpanel', { name: 'People' })).not.toBeNull()
    expect(screen.getByText('Ann')).not.toBeNull()
    expect(screen.queryByText('A-1')).toBeNull()
  })

  it('says how much of a large sheet is shown', () => {
    render(
      <SpreadsheetView
        workbook={{
          sheets: [
            sheet('Big', [['x']], { totalRows: 5_000, totalColumns: 120, isTruncated: true }),
          ],
        }}
      />,
    )

    expect(screen.getByRole('status').textContent).toBe(
      'This sheet is large, so only the first 1,000 of 5,000 rows and the first 100 of 120 columns are shown.',
    )
  })

  it('shows cell text as text, never as markup', () => {
    const { container } = render(
      <SpreadsheetView workbook={{ sheets: [sheet('S', [['<img src=x onerror=alert(1)>']])] }} />,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).not.toBeNull()
  })

  it('says so for an empty sheet, or a workbook with none', () => {
    render(<SpreadsheetView workbook={{ sheets: [sheet('Empty', [])] }} />)
    expect(screen.getByRole('status').textContent).toBe('This sheet is empty.')
    cleanup()

    render(<SpreadsheetView workbook={{ sheets: [] }} />)
    expect(screen.getByRole('status').textContent).toBe('This workbook has no sheets to show.')
  })
})
