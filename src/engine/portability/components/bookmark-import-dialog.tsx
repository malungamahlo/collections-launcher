import type { RefObject } from 'react'
import type {
  Collection,
  CollectionId,
} from '@app/features/collections/model/collection.types'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BookmarkPickerState } from '../hooks/use-bookmark-import'
import { getFolderBookmarks } from '../services/import-bookmark-folder'
import { BookmarkDestinationPicker } from './bookmark-destination-picker'
import { BookmarkFolderPicker } from './bookmark-folder-picker'
import { BookmarkListPicker } from './bookmark-list-picker'

interface BookmarkImportDialogProps {
  readonly pickerState: Exclude<BookmarkPickerState, { status: 'closed' }>
  /** The existing collections the bookmarks can be added to. */
  readonly collections: readonly Collection[]
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onSelectFolder: (folder: BookmarkTreeNode) => void
  /** Confirms the chosen folder — moves on to choosing its bookmarks. */
  readonly onConfirmFolder: () => void
  readonly onToggleBookmark: (bookmarkId: string) => void
  readonly onSelectAllBookmarks: () => void
  readonly onClearBookmarks: () => void
  /** Confirms the chosen bookmarks — moves on to choosing a destination, or straight to the preview. */
  readonly onConfirmBookmarks: () => void
  /** Reports the chosen destination; `undefined` means a new collection. */
  readonly onSelectTarget: (collectionId: CollectionId | undefined) => void
  /** Steps back one level, from either the destination or the bookmarks step. */
  readonly onBack: () => void
  /** Confirms the chosen destination and hands off to the preview. */
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/**
 * The steps that precede the import preview: choosing a bookmark folder,
 * choosing which of its bookmarks to import, then choosing where they go —
 * a new collection or an existing one. Confirming hands off to the shared
 * import preview dialog; nothing is saved here, and nothing here ever
 * writes to the browser's bookmarks.
 */
export function BookmarkImportDialog({
  pickerState,
  collections,
  fallbackFocusRef,
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
}: BookmarkImportDialogProps) {
  if (pickerState.status === 'error') {
    return (
      <Dialog
        title="Can’t read bookmarks"
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <p className="text-sm text-red-700" role="alert">
          {pickerState.message}
        </p>

        <div className="mt-5 flex justify-end border-t border-border pt-5">
          <Button autoFocus onClick={onClose}>
            Close
          </Button>
        </div>
      </Dialog>
    )
  }

  if (pickerState.status === 'choosing-bookmarks') {
    // With no existing collections there is no destination to choose, so
    // this is the last step and goes straight to the preview.
    const confirmBookmarksLabel =
      collections.length > 0 ? 'Next' : 'Preview import'

    return (
      <Dialog
        title="Choose bookmarks"
        description={`Select the bookmarks from “${pickerState.selectedFolder.title || 'Untitled folder'}” to import. You’ll see a preview before anything is saved.`}
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <BookmarkListPicker
          bookmarks={getFolderBookmarks(pickerState.selectedFolder)}
          selectedIds={pickerState.selectedBookmarkIds}
          onToggle={onToggleBookmark}
          onSelectAll={onSelectAllBookmarks}
          onClear={onClearBookmarks}
        />

        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button
            disabled={pickerState.selectedBookmarkIds.length === 0}
            onClick={onConfirmBookmarks}
          >
            {confirmBookmarksLabel}
          </Button>
        </div>
      </Dialog>
    )
  }

  if (pickerState.status === 'choosing-destination') {
    return (
      <Dialog
        title="Choose a collection"
        description={`Where should the selected bookmarks from “${pickerState.selectedFolder.title || 'Untitled folder'}” go? You’ll see a preview before anything is saved.`}
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <BookmarkDestinationPicker
          folderName={pickerState.selectedFolder.title}
          collections={collections}
          selectedTargetId={pickerState.selectedTargetId}
          onSelectTarget={onSelectTarget}
        />

        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onConfirm}>Preview import</Button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      title="Import bookmarks"
      description="Choose the bookmark folder to import. You’ll see a preview before anything is saved."
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      {pickerState.status === 'loading' ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading bookmarks…
        </p>
      ) : (
        <BookmarkFolderPicker
          nodes={pickerState.tree}
          selectedFolderId={pickerState.selectedFolder?.id}
          onSelectFolder={onSelectFolder}
        />
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={
            pickerState.status !== 'picking' || !pickerState.selectedFolder
          }
          onClick={onConfirmFolder}
        >
          Next
        </Button>
      </div>
    </Dialog>
  )
}
