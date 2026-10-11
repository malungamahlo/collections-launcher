import { useEffect, useId, useRef, type FormEvent } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Input } from '@app/shared/components/ui/input'
import { Label } from '@app/shared/components/ui/label'
import { Select } from '@app/shared/components/ui/select'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import type { Collection } from '../model/collection.types'
import { MAX_FILE_RESOURCE_SIZE_BYTES } from '../model/file-resource.validation'
import { RESOURCE_KINDS } from '../model/resource-kind-registry'
import type {
  ChosenFileSummary,
  FileResourceFormValues,
} from './file-resource-form.types'

interface FileResourceFormProps {
  readonly values: FileResourceFormValues
  readonly collections: readonly Collection[]
  /** The file picked so far, if any. */
  readonly chosenFile?: ChosenFileSummary
  readonly nameError?: string
  readonly fileError?: string
  readonly submissionError?: string
  readonly isPicking?: boolean
  readonly isSubmitting?: boolean
  readonly onValuesChange: (values: FileResourceFormValues) => void
  readonly onChooseFile: () => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

/** The formats the picker offers, read from the registry so this never drifts from it. */
const SUPPORTED_KINDS = RESOURCE_KINDS.map(kind => kind.label).join(', ')

/**
 * Chooses a file with the native picker, names it, and picks its collection.
 * The picker must be opened from a click, so choosing a file is its own
 * button rather than something the submit does.
 */
export function FileResourceForm({
  values,
  collections,
  chosenFile,
  nameError,
  fileError,
  submissionError,
  isPicking = false,
  isSubmitting = false,
  onValuesChange,
  onChooseFile,
  onSubmit,
  onCancel,
}: FileResourceFormProps) {
  const formId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileLabelId = `${formId}-file-label`
  const fileErrorId = `${formId}-file-error`
  const fileHintId = `${formId}-file-hint`
  const nameId = `${formId}-name`
  const nameErrorId = `${formId}-name-error`
  const collectionId = `${formId}-collection`

  useEffect(() => {
    if (nameError) {
      nameInputRef.current?.focus()
    }
  }, [nameError])

  /** Prevents navigation and delegates the workflow to the parent hook. */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <p id={fileLabelId} className="text-sm font-medium text-card-foreground">
          File
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            autoFocus
            aria-describedby={fileError ? fileErrorId : fileHintId}
            disabled={isPicking || isSubmitting}
            onClick={onChooseFile}
          >
            {isPicking
              ? 'Choosing…'
              : chosenFile
                ? 'Choose a different file'
                : 'Choose file…'}
          </Button>

          {chosenFile && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-card-foreground">
                {chosenFile.fileName}
              </p>
              <p className="text-xs text-muted-foreground">
                {chosenFile.kindLabel} · {formatFileSize(chosenFile.sizeBytes)}
              </p>
            </div>
          )}
        </div>

        {fileError ? (
          <p id={fileErrorId} className="text-sm text-red-700" role="alert">
            {fileError}
          </p>
        ) : (
          <p id={fileHintId} className="text-xs leading-5 text-muted-foreground">
            {chosenFile
              ? 'A copy is kept in this browser. Later changes to the original won’t appear here.'
              : `Supported: ${SUPPORTED_KINDS}, up to ${formatFileSize(MAX_FILE_RESOURCE_SIZE_BYTES)}.`}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={nameId}>Resource name</Label>
        <Input
          ref={nameInputRef}
          id={nameId}
          name="name"
          value={values.name}
          placeholder="Choose a file to suggest a name"
          autoComplete="off"
          required
          aria-invalid={nameError ? 'true' : undefined}
          aria-describedby={nameError ? nameErrorId : undefined}
          disabled={isSubmitting}
          onChange={event =>
            onValuesChange({ ...values, name: event.target.value })
          }
        />
        {nameError && (
          <p id={nameErrorId} className="text-sm text-red-700">
            {nameError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={collectionId}>Collection</Label>
        <Select
          id={collectionId}
          name="collectionId"
          value={values.collectionId}
          disabled={isSubmitting}
          onChange={event =>
            onValuesChange({ ...values, collectionId: event.target.value })
          }
        >
          {collections.map(collection => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </Select>
      </div>

      {submissionError && (
        <p className="text-sm text-red-700" role="alert">
          {submissionError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isPicking}>
          {isSubmitting ? 'Adding…' : 'Add file'}
        </Button>
      </div>
    </form>
  )
}
