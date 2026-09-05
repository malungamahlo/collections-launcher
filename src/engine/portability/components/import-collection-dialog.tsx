import { useId, type FormEvent, type RefObject } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import { Input } from '@app/shared/components/ui/input'
import { Label } from '@app/shared/components/ui/label'
import type { ImportCollectionState } from '../hooks/use-import-collection'

interface ImportCollectionDialogProps {
  readonly importState: Exclude<ImportCollectionState, { status: 'idle' }>
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onChosenNameChange: (name: string) => void
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/** Pluralizes a simple count-based label, e.g. "1 website" vs "3 websites". */
function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`
}

/**
 * Walks the user from a parsed bundle preview to a confirmed import, or
 * shows why the picked file couldn't be read at all. Nothing is written to
 * storage until the user confirms.
 */
export function ImportCollectionDialog({
  importState,
  fallbackFocusRef,
  onChosenNameChange,
  onConfirm,
  onClose,
}: ImportCollectionDialogProps) {
  const nameId = useId()
  const nameErrorId = useId()

  if (importState.status === 'error') {
    return (
      <Dialog
        title="Can’t import this file"
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <p className="text-sm text-red-700" role="alert">
          {importState.message}
        </p>

        <div className="mt-5 flex justify-end border-t border-border pt-5">
          <Button autoFocus onClick={onClose}>
            Close
          </Button>
        </div>
      </Dialog>
    )
  }

  if (importState.status === 'done') {
    return (
      <Dialog
        title="Collection imported"
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <p className="text-sm text-muted-foreground">
          “{importState.collectionName}” was added with{' '}
          {countLabel(importState.resourceCount, 'resource', 'resources')}.
        </p>

        <div className="mt-5 flex justify-end border-t border-border pt-5">
          <Button autoFocus onClick={onClose}>
            Done
          </Button>
        </div>
      </Dialog>
    )
  }

  const { preview, chosenName } = importState
  const isSubmitting = importState.status === 'importing'
  const nameError =
    importState.status === 'previewing' ? importState.nameError : undefined
  const hasNameConflict =
    importState.status === 'previewing' ? importState.hasNameConflict : false

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onConfirm()
  }

  return (
    <Dialog
      title="Import collection"
      description="Review what this file contains before adding it as a new collection."
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor={nameId}>Collection name</Label>
          <Input
            id={nameId}
            value={chosenName}
            autoComplete="off"
            autoFocus
            required
            aria-invalid={nameError ? 'true' : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
            disabled={isSubmitting}
            onChange={event => onChosenNameChange(event.target.value)}
          />
          {nameError && (
            <p id={nameErrorId} className="text-sm text-red-700">
              {nameError}
            </p>
          )}
          {!nameError && hasNameConflict && (
            <p className="text-sm text-red-700">
              A collection named “{chosenName}” already exists. Choose a
              different name to import this collection.
            </p>
          )}
        </div>

        {preview.description && (
          <p className="text-sm text-muted-foreground">
            {preview.description}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">
            {countLabel(preview.resources.length, 'website', 'websites')}
          </p>

          {preview.resources.length > 0 && (
            <ul className="scroll-slim max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {preview.resources.map(resource => (
                <li
                  key={resource.url}
                  className="truncate text-sm text-muted-foreground"
                  title={`${resource.name} — ${resource.url}`}
                >
                  {resource.name} — {resource.url}
                </li>
              ))}
            </ul>
          )}

          {(preview.skippedDuplicateCount > 0 ||
            preview.skippedInvalidCount > 0) && (
            <p className="text-xs text-muted-foreground">
              {preview.skippedDuplicateCount > 0 &&
                `${countLabel(preview.skippedDuplicateCount, 'duplicate resource', 'duplicate resources')} skipped. `}
              {preview.skippedInvalidCount > 0 &&
                `${countLabel(preview.skippedInvalidCount, 'invalid resource', 'invalid resources')} skipped.`}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || hasNameConflict}
          >
            {isSubmitting ? 'Importing…' : 'Import collection'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
