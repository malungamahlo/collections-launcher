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
  children: [
    { id: 'a', title: 'GitHub', url: 'https://github.com/' },
    { id: 'b', title: 'MDN', url: 'https://developer.mozilla.org/' },
  ],
}

const tree: readonly BookmarkTreeNode[] = [
  { id: 'bar', title: 'Bookmarks bar', children: [workFolder] },
]

function renderDialog(
  pickerState: Exclude<BookmarkPickerState, { status: 'closed' }>,
  collections: readonly Collection[] = [],
) {
  const onSelectFolder = vi.fn()
  const onConfirmFolder = vi.fn()
  const onToggleBookmark = vi.fn()
  const onSelectAllBookmarks = vi.fn()
  const onClearBookmarks = vi.fn()
  const onConfirmBookmarks = vi.fn()
  const onSelectTarget = vi.fn()
  const onBack = vi.fn()
  const onConfirm = vi.fn()
  const onClose = vi.fn()

  render(
    <BookmarkImportDialog
      pickerState={pickerState}
      collections={collections}
      onSelectFolder={onSelectFolder}
      onConfirmFolder={onConfirmFolder}
      onToggleBookmark={onToggleBookmark}
      onSelectAllBookmarks={onSelectAllBookmarks}
      onClearBookmarks={onClearBookmarks}
      onConfirmBookmarks={onConfirmBookmarks}
      onSelectTarget={onSelectTarget}
      onBack={onBack}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )

  return {
    onSelectFolder,
    onConfirmFolder,
    onToggleBookmark,
    onSelectAllBookmarks,
    onClearBookmarks,
    onConfirmBookmarks,
    onSelectTarget,
    onBack,
    onConfirm,
    onClose,
  }
}

function getButton(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement
}

describe('BookmarkImportDialog', () => {
  describe('folder step', () => {
    it('shows a loading message and a disabled Next button while loading', () => {
      renderDialog({ status: 'loading' })

      expect(screen.getByText('Loading bookmarks…')).not.toBeNull()
      expect(getButton('Next').disabled).toBe(true)
    })

    it('shows the bookmark folders while picking', () => {
      renderDialog({ status: 'picking', tree })

      expect(screen.getByText('Bookmarks bar')).not.toBeNull()
      expect(screen.getByText('Work')).not.toBeNull()
    })

    it('keeps Next disabled until a folder is selected', () => {
      renderDialog({ status: 'picking', tree })

      expect(getButton('Next').disabled).toBe(true)
    })

    it('enables Next once a folder is selected, and confirms the folder on click', async () => {
      const user = userEvent.setup()
      const { onConfirmFolder, onConfirmBookmarks, onConfirm } = renderDialog({
        status: 'picking',
        tree,
        selectedFolder: workFolder,
      })

      expect(getButton('Next').disabled).toBe(false)

      await user.click(getButton('Next'))

      expect(onConfirmFolder).toHaveBeenCalledOnce()
      expect(onConfirmBookmarks).not.toHaveBeenCalled()
      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('says "Next" whether or not there are collections, as a bookmarks step always follows', () => {
      renderDialog({ status: 'picking', tree, selectedFolder: workFolder }, [
        createTestCollection({ id: 'reference', name: 'Reference' }),
      ])

      expect(getButton('Next')).not.toBeNull()
      expect(screen.queryByRole('button', { name: 'Preview import' })).toBeNull()
    })

    it('reports a clicked folder', async () => {
      const user = userEvent.setup()
      const { onSelectFolder } = renderDialog({ status: 'picking', tree })

      await user.click(screen.getByText('Work'))

      expect(onSelectFolder).toHaveBeenCalledWith(workFolder)
    })

    it('does not show the bookmarks or destinations yet', () => {
      renderDialog({ status: 'picking', tree }, [
        createTestCollection({ id: 'reference', name: 'Reference' }),
      ])

      expect(screen.queryByRole('checkbox')).toBeNull()
      expect(screen.queryByRole('radiogroup')).toBeNull()
    })

    it('closes on Cancel', async () => {
      const user = userEvent.setup()
      const { onClose } = renderDialog({ status: 'picking', tree })

      await user.click(getButton('Cancel'))

      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('bookmarks step', () => {
    const collections = [
      createTestCollection({ id: 'reference', name: 'Reference' }),
    ]
    const bookmarksState: Extract<
      BookmarkPickerState,
      { status: 'choosing-bookmarks' }
    > = {
      status: 'choosing-bookmarks',
      tree,
      selectedFolder: workFolder,
      selectedBookmarkIds: ['a'],
    }

    it('names the chosen folder and lists its bookmarks instead of the folder tree', () => {
      renderDialog(bookmarksState, collections)

      expect(screen.getByText('Choose bookmarks')).not.toBeNull()
      expect(screen.getByText(/bookmarks from “Work”/)).not.toBeNull()
      expect(screen.getAllByRole('checkbox')).toHaveLength(2)
      expect(screen.queryByText('Bookmarks bar')).toBeNull()
    })

    it('reflects the current selection', () => {
      renderDialog(bookmarksState, collections)

      const checked = (
        screen.getAllByRole('checkbox') as HTMLInputElement[]
      ).map(checkbox => checkbox.checked)

      expect(checked).toEqual([true, false])
      expect(screen.getByText('1 of 2 selected')).not.toBeNull()
    })

    it('reports a toggled bookmark', async () => {
      const user = userEvent.setup()
      const { onToggleBookmark } = renderDialog(bookmarksState, collections)

      await user.click(screen.getByRole('checkbox', { name: /MDN/ }))

      expect(onToggleBookmark).toHaveBeenCalledWith('b')
    })

    it('reports Select all and Clear', async () => {
      const user = userEvent.setup()
      const { onSelectAllBookmarks, onClearBookmarks } = renderDialog(
        bookmarksState,
        collections,
      )

      await user.click(getButton('Select all'))
      await user.click(getButton('Clear'))

      expect(onSelectAllBookmarks).toHaveBeenCalledOnce()
      expect(onClearBookmarks).toHaveBeenCalledOnce()
    })

    it('says "Next" and confirms the bookmarks when there are collections to choose from', async () => {
      const user = userEvent.setup()
      const { onConfirmBookmarks } = renderDialog(bookmarksState, collections)

      await user.click(getButton('Next'))

      expect(onConfirmBookmarks).toHaveBeenCalledOnce()
    })

    it('says "Preview import" when there are no collections, as it is the last step', async () => {
      const user = userEvent.setup()
      const { onConfirmBookmarks } = renderDialog(bookmarksState, [])

      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()

      await user.click(getButton('Preview import'))

      expect(onConfirmBookmarks).toHaveBeenCalledOnce()
    })

    it('keeps the confirm button disabled while nothing is selected', () => {
      renderDialog({ ...bookmarksState, selectedBookmarkIds: [] }, collections)

      expect(getButton('Next').disabled).toBe(true)
    })

    it('goes back to the folder step', async () => {
      const user = userEvent.setup()
      const { onBack } = renderDialog(bookmarksState, collections)

      await user.click(getButton('Back'))

      expect(onBack).toHaveBeenCalledOnce()
    })
  })

  describe('destination step', () => {
    const collections = [
      createTestCollection({ id: 'reference', name: 'Reference' }),
      createTestCollection({ id: 'reading', name: 'Reading list' }),
    ]
    const destinationState: Extract<
      BookmarkPickerState,
      { status: 'choosing-destination' }
    > = {
      status: 'choosing-destination',
      tree,
      selectedFolder: workFolder,
      selectedBookmarkIds: ['a'],
    }

    it('names the chosen folder and shows the destinations instead of the bookmarks', () => {
      renderDialog(destinationState, collections)

      expect(screen.getByText('Choose a collection')).not.toBeNull()
      expect(screen.getByText(/selected bookmarks from “Work”/)).not.toBeNull()
      expect(screen.getByRole('radiogroup')).not.toBeNull()
      expect(screen.queryByRole('checkbox')).toBeNull()
    })

    it('reports the chosen destination', async () => {
      const user = userEvent.setup()
      const { onSelectTarget } = renderDialog(destinationState, collections)

      await user.click(screen.getByRole('radio', { name: /Reading list/ }))

      expect(onSelectTarget).toHaveBeenCalledWith('reading')
    })

    it('goes back to the bookmarks step', async () => {
      const user = userEvent.setup()
      const { onBack } = renderDialog(destinationState, collections)

      await user.click(getButton('Back'))

      expect(onBack).toHaveBeenCalledOnce()
    })

    it('confirms the destination with "Preview import"', async () => {
      const user = userEvent.setup()
      const { onConfirm, onConfirmBookmarks } = renderDialog(
        destinationState,
        collections,
      )

      await user.click(getButton('Preview import'))

      expect(onConfirm).toHaveBeenCalledOnce()
      expect(onConfirmBookmarks).not.toHaveBeenCalled()
    })
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

    await user.click(getButton('Close'))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
