import { useId, type FormEvent, type RefObject } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import { Input } from '@app/shared/components/ui/input'
import { Label } from '@app/shared/components/ui/label'
import { getResourceKind } from '@app/features/collections/model/resource-kind-registry'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import type { ImportCollectionState } from '../hooks/use-import-collection'
import { isImportPreviewFile } from '../services/import-collection-bundle'

interface ImportCollectionDialogProps {
  readonly importState: Exclude<ImportCollectionState, { status: 'idle' }>
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onChosenNameChange: (name: string) => void
  readonly onConfirm: () => void
  readonly onClose: () => void
}

/** Pluralizes a simple count-based label, e.g. "1 resource" vs "3 resources". */
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

  if (importState.status === 'reading') {
    const { progress } = importState

    return (
      <Dialog
        title="Reading file…"
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <p className="text-sm text-muted-foreground" role="status">
          {progress && progress.totalFiles > 0
            ? `Checking ${countLabel(progress.totalFiles, 'file', 'files')}: ${progress.filesRead} of ${progress.totalFiles} done.`
            : 'Checking the file before anything is added.'}
        </p>

        <div className="mt-5 flex justify-end border-t border-border pt-5">
          <Button variant="secondary" autoFocus onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Dialog>
    )
  }

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
        title={
          importState.addedToExisting
            ? 'Added to collection'
            : 'Collection imported'
        }
        fallbackFocusRef={fallbackFocusRef}
        onClose={onClose}
      >
        <p className="text-sm text-muted-foreground">
          {importState.addedToExisting ? (
            <>
              {countLabel(importState.resourceCount, 'resource was', 'resources were')}{' '}
              added to “{importState.collectionName}”.
            </>
          ) : (
            <>
              “{importState.collectionName}” was added with{' '}
              {countLabel(importState.resourceCount, 'resource', 'resources')}.
            </>
          )}
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
  const { target } = preview
  const isSubmitting = importState.status === 'importing'
  const nameError =
    importState.status === 'previewing' ? importState.nameError : undefined
  const hasNameConflict =
    importState.status === 'previewing' ? importState.hasNameConflict : false
  const hasNothingToAdd = target !== undefined && preview.resources.length === 0
  const files = preview.resources.filter(isImportPreviewFile)
  const filesTotalBytes = files.reduce((total, file) => total + file.sizeBytes, 0)
  const idleLabel = target ? 'Add to collection' : 'Import collection'
  const busyLabel = target ? 'Adding…' : 'Importing…'

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onConfirm()
  }

  return (
    <Dialog
      title={target ? `Add to “${target.name}”` : 'Import collection'}
      description={
        target
          ? 'Review what will be added to this collection before anything is saved.'
          : 'Review what this file contains before adding it as a new collection.'
      }
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {!target && (
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
        )}

        {preview.description && (
          <p className="text-sm text-muted-foreground">
            {preview.description}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-card-foreground">
            {countLabel(preview.resources.length, 'resource', 'resources')}
          </p>

          {preview.resources.length > 0 && (
            <ul className="scroll-slim max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {preview.resources.map((resource, index) => {
                // A website shows its address; a file, what kind it is and how big.
                const detail = isImportPreviewFile(resource)
                  ? `${getResourceKind(resource.mimeType).label} · ${formatFileSize(resource.sizeBytes)}`
                  : resource.url

                return (
                  <li
                    key={index}
                    className="truncate text-sm text-muted-foreground"
                    title={`${resource.name} — ${detail}`}
                  >
                    {resource.name} — {detail}
                  </li>
                )
              })}
            </ul>
          )}

          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {countLabel(files.length, 'file', 'files')} ({formatFileSize(filesTotalBytes)}) will
              be stored in this browser.
            </p>
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

          {hasNothingToAdd && (
            <p className="text-sm text-muted-foreground">
              There’s nothing new to add to “{target.name}”.
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
            disabled={isSubmitting || hasNameConflict || hasNothingToAdd}
          >
            {isSubmitting ? busyLabel : idleLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
