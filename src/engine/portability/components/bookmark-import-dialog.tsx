import type { RefObject } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BookmarkPickerState } from '../hooks/use-bookmark-import'
import { BookmarkFolderPicker } from './bookmark-folder-picker'

interface BookmarkImportDialogProps {
  readonly pickerState: Exclude<BookmarkPickerState, { status: 'closed' }>
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onSelectFolder: (folder: BookmarkTreeNode) => void
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/**
 * The first step of importing bookmarks: choosing which folder becomes a
 * new collection. Confirming hands off to the shared import preview dialog;
 * nothing is saved here, and nothing here ever writes to the browser's
 * bookmarks.
 */
export function BookmarkImportDialog({
  pickerState,
  fallbackFocusRef,
  onSelectFolder,
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

  return (
    <Dialog
      title="Import bookmarks"
      description="Choose a bookmark folder to import as a new collection. You’ll see a preview before anything is saved."
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
          onClick={onConfirm}
        >
          Preview import
        </Button>
      </div>
    </Dialog>
  )
}
