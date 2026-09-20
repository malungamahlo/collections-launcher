import { useId, type RefObject } from 'react'
import type {
  Collection,
  CollectionId,
} from '@app/features/collections/model/collection.types'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import { Label } from '@app/shared/components/ui/label'
import { Select } from '@app/shared/components/ui/select'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BookmarkPickerState } from '../hooks/use-bookmark-import'
import { BookmarkFolderPicker } from './bookmark-folder-picker'

interface BookmarkImportDialogProps {
  readonly pickerState: Exclude<BookmarkPickerState, { status: 'closed' }>
  /** The existing collections the bookmarks can be added to. */
  readonly collections: readonly Collection[]
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onSelectFolder: (folder: BookmarkTreeNode) => void
  /** Reports the chosen destination; `undefined` means a new collection. */
  readonly onSelectTarget: (collectionId: CollectionId | undefined) => void
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/**
 * The first step of importing bookmarks: choosing which folder to import and
 * whether it becomes a new collection or is added to an existing one.
 * Confirming hands off to the shared import preview dialog; nothing is saved
 * here, and nothing here ever writes to the browser's bookmarks.
 */
export function BookmarkImportDialog({
  pickerState,
  collections,
  fallbackFocusRef,
  onSelectFolder,
  onSelectTarget,
  onConfirm,
  onClose,
}: BookmarkImportDialogProps) {
  const targetId = useId()

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
      description="Choose a bookmark folder to import, and where to put it. You’ll see a preview before anything is saved."
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      {pickerState.status === 'loading' ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading bookmarks…
        </p>
      ) : (
        <div className="space-y-5">
          <BookmarkFolderPicker
            nodes={pickerState.tree}
            selectedFolderId={pickerState.selectedFolder?.id}
            onSelectFolder={onSelectFolder}
          />

          {collections.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor={targetId}>Add to</Label>
              <Select
                id={targetId}
                value={pickerState.selectedTargetId ?? ''}
                onChange={event =>
                  onSelectTarget(event.target.value || undefined)
                }
              >
                <option value="">New collection (named after the folder)</option>
                {collections.map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
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
