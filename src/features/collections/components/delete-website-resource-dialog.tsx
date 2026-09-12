import type { RefObject } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import type { Collection, WebsiteResource } from '../model/collection.types'

interface DeleteWebsiteResourceDialogProps {
  readonly collection: Collection
  readonly resource: WebsiteResource
  readonly isDeleting: boolean
  readonly errorMessage?: string
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/** Requires confirmation before removing a saved website. */
export function DeleteWebsiteResourceDialog({
  collection,
  resource,
  isDeleting,
  errorMessage,
  fallbackFocusRef,
  onConfirm,
  onClose,
}: DeleteWebsiteResourceDialogProps) {
  return (
    <Dialog
      title="Delete resource?"
      description={`“${resource.name}” will be removed from “${collection.name}”. The collection itself will not be deleted.`}
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
          {isDeleting ? 'Deleting…' : 'Delete resource'}
        </Button>
      </div>
    </Dialog>
  )
}
