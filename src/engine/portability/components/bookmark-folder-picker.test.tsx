// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import { BookmarkFolderPicker } from './bookmark-folder-picker'

afterEach(() => {
  cleanup()
})

const nodes: readonly BookmarkTreeNode[] = [
  {
    id: 'bar',
    title: 'Bookmarks bar',
    children: [
      { id: 'gh', title: 'GitHub', url: 'https://github.com/' },
      {
        id: 'work',
        title: 'Work',
        children: [{ id: 'nested', title: 'Nested folder', children: [] }],
      },
    ],
  },
  { id: 'other', title: 'Other bookmarks', children: [] },
]

describe('BookmarkFolderPicker', () => {
  it('renders only folders, not individual bookmarks', () => {
    render(<BookmarkFolderPicker nodes={nodes} onSelectFolder={vi.fn()} />)

    expect(screen.getByText('Bookmarks bar')).not.toBeNull()
    expect(screen.getByText('Other bookmarks')).not.toBeNull()
    expect(screen.queryByText('GitHub')).toBeNull()
  })

  it('expands a top-level folder by default but not a nested one', () => {
    render(<BookmarkFolderPicker nodes={nodes} onSelectFolder={vi.fn()} />)

    expect(screen.getByText('Work')).not.toBeNull()
    expect(screen.queryByText('Nested folder')).toBeNull()
  })

  it('expands a folder to reveal its subfolders on click', async () => {
    const user = userEvent.setup()
    render(<BookmarkFolderPicker nodes={nodes} onSelectFolder={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Expand Work' }))

    expect(screen.getByText('Nested folder')).not.toBeNull()
  })

  it('collapses an expanded folder on a second click', async () => {
    const user = userEvent.setup()
    render(<BookmarkFolderPicker nodes={nodes} onSelectFolder={vi.fn()} />)

    const toggle = screen.getByRole('button', { name: 'Expand Work' })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Collapse Work' }))

    expect(screen.queryByText('Nested folder')).toBeNull()
  })

  it('disables the expand toggle for a folder with no subfolders', () => {
    render(<BookmarkFolderPicker nodes={nodes} onSelectFolder={vi.fn()} />)

    const toggle = screen.getByRole('button', {
      name: 'Expand Other bookmarks',
    }) as HTMLButtonElement

    expect(toggle.disabled).toBe(true)
  })

  it('calls onSelectFolder with the clicked folder', async () => {
    const user = userEvent.setup()
    const onSelectFolder = vi.fn()
    render(
      <BookmarkFolderPicker nodes={nodes} onSelectFolder={onSelectFolder} />,
    )

    await user.click(screen.getByText('Work'))

    expect(onSelectFolder).toHaveBeenCalledWith(nodes[0]?.children?.[1])
  })

  it('marks the selected folder', () => {
    render(
      <BookmarkFolderPicker
        nodes={nodes}
        selectedFolderId="bar"
        onSelectFolder={vi.fn()}
      />,
    )

    const selectedButton = screen.getByText('Bookmarks bar').closest('button')

    expect(selectedButton?.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows a message when there are no bookmark folders', () => {
    render(<BookmarkFolderPicker nodes={[]} onSelectFolder={vi.fn()} />)

    expect(screen.getByText('No bookmark folders found.')).not.toBeNull()
  })
})
