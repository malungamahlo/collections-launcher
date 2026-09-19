// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BookmarkPickerState } from '../hooks/use-bookmark-import'
import { BookmarkImportDialog } from './bookmark-import-dialog'

afterEach(() => {
  cleanup()
})

const workFolder: BookmarkTreeNode = {
  id: 'work',
  title: 'Work',
  children: [],
}

const tree: readonly BookmarkTreeNode[] = [
  { id: 'bar', title: 'Bookmarks bar', children: [workFolder] },
]

function renderDialog(
  pickerState: Exclude<BookmarkPickerState, { status: 'closed' }>,
) {
  const onSelectFolder = vi.fn()
  const onConfirm = vi.fn()
  const onClose = vi.fn()

  render(
    <BookmarkImportDialog
      pickerState={pickerState}
      onSelectFolder={onSelectFolder}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )

  return { onSelectFolder, onConfirm, onClose }
}

function getPreviewButton(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: 'Preview import',
  }) as HTMLButtonElement
}

describe('BookmarkImportDialog', () => {
  it('shows a loading message and a disabled Preview button while loading', () => {
    renderDialog({ status: 'loading' })

    expect(screen.getByText('Loading bookmarks…')).not.toBeNull()
    expect(getPreviewButton().disabled).toBe(true)
  })

  it('shows the bookmark folders while picking', () => {
    renderDialog({ status: 'picking', tree })

    expect(screen.getByText('Bookmarks bar')).not.toBeNull()
    expect(screen.getByText('Work')).not.toBeNull()
  })

  it('keeps Preview disabled until a folder is selected', () => {
    renderDialog({ status: 'picking', tree })

    expect(getPreviewButton().disabled).toBe(true)
  })

  it('enables Preview once a folder is selected, and confirms on click', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog({
      status: 'picking',
      tree,
      selectedFolder: workFolder,
    })

    expect(getPreviewButton().disabled).toBe(false)

    await user.click(getPreviewButton())

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('reports a clicked folder', async () => {
    const user = userEvent.setup()
    const { onSelectFolder } = renderDialog({ status: 'picking', tree })

    await user.click(screen.getByText('Work'))

    expect(onSelectFolder).toHaveBeenCalledWith(workFolder)
  })

  it('closes on Cancel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({ status: 'picking', tree })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the error state with a Close button', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({
      status: 'error',
      message: 'Your bookmarks could not be read. Try again.',
    })

    expect(
      screen.getByText('Your bookmarks could not be read. Try again.'),
    ).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
