import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import type { RefObject } from 'react'
import type { Collection } from '../model/collection.types'

interface DeleteCollectionDialogProps {
  readonly collection: Collection
  readonly isDeleting: boolean
  readonly errorMessage?: string
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/**
 * Requires explicit confirmation before deleting a collection and its resources.
 */
export function DeleteCollectionDialog({
  collection,
  isDeleting,
  errorMessage,
  fallbackFocusRef,
  onConfirm,
  onClose,
}: DeleteCollectionDialogProps) {
  const resourceCount = collection.resources.length
  const resourceWarning =
    resourceCount === 1
      ? 'Its 1 saved resource will also be removed.'
      : `Its ${resourceCount} saved resources will also be removed.`

  return (
    <Dialog
      title="Delete collection?"
      description={`“${collection.name}” will be permanently deleted. ${resourceWarning}`}
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      {errorMessage && (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          autoFocus
          disabled={isDeleting}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? 'Deleting…' : 'Delete collection'}
        </Button>
      </div>
    </Dialog>
  )
}
