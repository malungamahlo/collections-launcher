// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FolderBookmark } from '../services/import-bookmark-folder'
import { BookmarkListPicker } from './bookmark-list-picker'

afterEach(() => {
  cleanup()
})

const github: FolderBookmark = {
  id: 'a',
  title: 'GitHub',
  url: 'https://github.com/',
}
const mdn: FolderBookmark = {
  id: 'b',
  title: 'MDN',
  url: 'https://developer.mozilla.org/',
}
const extensions: FolderBookmark = {
  id: 'c',
  title: 'Extensions',
  url: 'chrome://extensions/',
}

function renderPicker(
  overrides: Partial<{
    bookmarks: readonly FolderBookmark[]
    selectedIds: readonly string[]
  }> = {},
) {
  const onToggle = vi.fn()
  const onSelectAll = vi.fn()
  const onClear = vi.fn()

  render(
    <BookmarkListPicker
      bookmarks={[github, mdn, extensions]}
      selectedIds={['a', 'b']}
      onToggle={onToggle}
      onSelectAll={onSelectAll}
      onClear={onClear}
      {...overrides}
    />,
  )

  return { onToggle, onSelectAll, onClear }
}

function getCheckboxes(): HTMLInputElement[] {
  return screen.getAllByRole('checkbox') as HTMLInputElement[]
}

describe('BookmarkListPicker', () => {
  it('lists every bookmark with its title and URL, in order', () => {
    renderPicker()

    expect(screen.getByText('GitHub')).not.toBeNull()
    expect(screen.getByText('https://github.com/')).not.toBeNull()
    expect(getCheckboxes()).toHaveLength(3)
  })

  it('ticks the selected bookmarks', () => {
    renderPicker({ selectedIds: ['b'] })

    expect(getCheckboxes().map(checkbox => checkbox.checked)).toEqual([
      false,
      true,
      false,
    ])
  })

  it('counts the selection against only the importable bookmarks', () => {
    renderPicker()

    expect(screen.getByText('2 of 2 selected')).not.toBeNull()
  })

  it('reports the id of a toggled bookmark', async () => {
    const user = userEvent.setup()
    const { onToggle } = renderPicker()

    await user.click(screen.getByRole('checkbox', { name: /MDN/ }))

    expect(onToggle).toHaveBeenCalledWith('b')
  })

  it('shows a bookmark that cannot be imported as disabled, with the reason', () => {
    renderPicker()

    const extensionsCheckbox = screen.getByRole('checkbox', {
      name: /Extensions/,
    }) as HTMLInputElement

    expect(extensionsCheckbox.disabled).toBe(true)
    expect(screen.getByText('Can’t be imported')).not.toBeNull()
  })

  it('labels an untitled bookmark as such, and disables it', () => {
    renderPicker({
      bookmarks: [{ id: 'z', title: '', url: 'https://example.com/' }],
      selectedIds: [],
    })

    expect(screen.getByText('Untitled bookmark')).not.toBeNull()
    expect(getCheckboxes()[0]?.disabled).toBe(true)
  })

  it('reports Select all and Clear', async () => {
    const user = userEvent.setup()
    const { onSelectAll, onClear } = renderPicker({ selectedIds: ['a'] })

    await user.click(screen.getByRole('button', { name: 'Select all' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onSelectAll).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('disables Select all when everything importable is already selected', () => {
    renderPicker()

    const selectAll = screen.getByRole('button', {
      name: 'Select all',
    }) as HTMLButtonElement

    expect(selectAll.disabled).toBe(true)
  })

  it('disables Clear when nothing is selected', () => {
    renderPicker({ selectedIds: [] })

    const clear = screen.getByRole('button', {
      name: 'Clear',
    }) as HTMLButtonElement

    expect(clear.disabled).toBe(true)
    expect(screen.getByText('0 of 2 selected')).not.toBeNull()
  })

  it('explains an empty folder and points to its subfolders', () => {
    renderPicker({ bookmarks: [], selectedIds: [] })

    expect(screen.getByText(/This folder has no bookmarks/)).not.toBeNull()
    expect(screen.getByText(/subfolders aren’t included/)).not.toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
