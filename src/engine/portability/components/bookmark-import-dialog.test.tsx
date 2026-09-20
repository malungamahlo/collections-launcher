// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '@app/features/collections/model/collection.types'
import { createTestCollection } from '@app/features/collections/test/collection.fixtures'
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
  collections: readonly Collection[] = [],
) {
  const onSelectFolder = vi.fn()
  const onSelectTarget = vi.fn()
  const onConfirm = vi.fn()
  const onClose = vi.fn()

  render(
    <BookmarkImportDialog
      pickerState={pickerState}
      collections={collections}
      onSelectFolder={onSelectFolder}
      onSelectTarget={onSelectTarget}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )

  return { onSelectFolder, onSelectTarget, onConfirm, onClose }
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

  describe('destination collection', () => {
    const collections = [
      createTestCollection({ id: 'reference', name: 'Reference' }),
      createTestCollection({ id: 'reading', name: 'Reading list' }),
    ]

    function getDestinationSelect(): HTMLSelectElement {
      return screen.getByLabelText('Add to') as HTMLSelectElement
    }

    it('offers a new collection first, then each existing collection', () => {
      renderDialog({ status: 'picking', tree }, collections)

      const optionLabels = Array.from(getDestinationSelect().options).map(
        option => option.textContent,
      )

      expect(optionLabels).toEqual([
        'New collection (named after the folder)',
        'Reference',
        'Reading list',
      ])
    })

    it('defaults to a new collection', () => {
      renderDialog({ status: 'picking', tree }, collections)

      expect(getDestinationSelect().value).toBe('')
    })

    it('shows the currently selected collection', () => {
      renderDialog(
        { status: 'picking', tree, selectedTargetId: 'reading' },
        collections,
      )

      expect(getDestinationSelect().value).toBe('reading')
    })

    it('reports the chosen collection, and undefined when switching back to a new one', async () => {
      const user = userEvent.setup()
      const { onSelectTarget } = renderDialog(
        { status: 'picking', tree, selectedTargetId: 'reference' },
        collections,
      )

      await user.selectOptions(getDestinationSelect(), 'reading')
      await user.selectOptions(getDestinationSelect(), '')

      expect(onSelectTarget).toHaveBeenNthCalledWith(1, 'reading')
      expect(onSelectTarget).toHaveBeenNthCalledWith(2, undefined)
    })

    it('hides the destination choice when there are no collections to add to', () => {
      renderDialog({ status: 'picking', tree })

      expect(screen.queryByLabelText('Add to')).toBeNull()
    })

    it('hides the destination choice while the bookmarks are loading', () => {
      renderDialog({ status: 'loading' }, collections)

      expect(screen.queryByLabelText('Add to')).toBeNull()
    })
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
