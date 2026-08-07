import { useId, useRef, type FormEvent } from 'react'
import { CheckCircle2, FolderPlus, Globe2 } from 'lucide-react'
import type { Collection } from '@app/features/collections/model/collection.types'
import { Button } from '@app/shared/components/ui/button'
import { Input } from '@app/shared/components/ui/input'
import { Select } from '@app/shared/components/ui/select'
import type { ActivePage } from '@app/platform/browser/active-tab.adapter'
import type { ToolbarCaptureValues } from '../hooks/use-toolbar-capture'

const NEW_COLLECTION_VALUE = '__new_collection__'

interface ToolbarCaptureFormProps {
  readonly page: ActivePage
  readonly collections: readonly Collection[]
  readonly values: ToolbarCaptureValues
  readonly nameError?: string
  readonly collectionError?: string
  readonly submissionError?: string
  readonly successMessage?: string
  readonly isSaving: boolean
  readonly onValuesChange: (values: ToolbarCaptureValues) => void
  readonly onSubmit: () => void
}

/** Displays and edits the active page before saving it to a collection. */
export function ToolbarCaptureForm({
  page,
  collections,
  values,
  nameError,
  collectionError,
  submissionError,
  successMessage,
  isSaving,
  onValuesChange,
  onSubmit,
}: ToolbarCaptureFormProps) {
  const formId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameId = `${formId}-name`
  const nameErrorId = `${formId}-name-error`
  const destinationId = `${formId}-destination`
  const collectionErrorId = `${formId}-collection-error`
  const newCollectionNameId = `${formId}-new-collection-name`
  const destinationValue =
    values.destination === 'new'
      ? NEW_COLLECTION_VALUE
      : values.collectionId

  /** Prevents navigation and delegates persistence to the capture workflow. */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="rounded-xl border border-border bg-muted/60 p-3">
        <div className="flex items-start gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground"
            aria-hidden="true"
          >
            <Globe2 className="size-4" />
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-card-foreground">
              {page.title}
            </p>
            <p
              className="mt-1 truncate text-xs text-muted-foreground"
              title={page.url}
              aria-label={`Active page URL: ${page.url}`}
            >
              {page.url}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium text-card-foreground"
          htmlFor={nameId}
        >
          Friendly name
        </label>
        <Input
          ref={nameInputRef}
          id={nameId}
          name="name"
          value={values.name}
          autoComplete="off"
          autoFocus
          required
          disabled={isSaving}
          aria-invalid={nameError ? 'true' : undefined}
          aria-describedby={nameError ? nameErrorId : undefined}
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
        <label
          className="text-sm font-medium text-card-foreground"
          htmlFor={destinationId}
        >
          Save to collection
        </label>
        <Select
          id={destinationId}
          name="destination"
          value={destinationValue}
          disabled={isSaving}
          aria-invalid={collectionError ? 'true' : undefined}
          aria-describedby={collectionError ? collectionErrorId : undefined}
          onChange={event => {
            const nextValue = event.target.value
            onValuesChange(
              nextValue === NEW_COLLECTION_VALUE
                ? { ...values, destination: 'new' }
                : {
                    ...values,
                    destination: 'existing',
                    collectionId: nextValue,
                  },
            )
          }}
        >
          {collections.map(collection => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
          <option value={NEW_COLLECTION_VALUE}>
            Create a new collection…
          </option>
        </Select>
      </div>

      {values.destination === 'new' && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <label
            className="flex items-center gap-2 text-sm font-medium text-card-foreground"
            htmlFor={newCollectionNameId}
          >
            <FolderPlus className="size-4" aria-hidden="true" />
            New collection name
          </label>
          <Input
            id={newCollectionNameId}
            name="newCollectionName"
            value={values.newCollectionName}
            placeholder="For example, Research"
            autoComplete="off"
            required
            disabled={isSaving}
            aria-invalid={collectionError ? 'true' : undefined}
            aria-describedby={
              collectionError ? collectionErrorId : undefined
            }
            onChange={event =>
              onValuesChange({
                ...values,
                newCollectionName: event.target.value,
              })
            }
          />
        </div>
      )}

      {collectionError && (
        <p id={collectionErrorId} className="text-sm text-red-700">
          {collectionError}
        </p>
      )}

      {submissionError && (
        <p className="text-sm text-red-700" role="alert">
          {submissionError}
        </p>
      )}

      {successMessage && (
        <p
          className="flex items-center gap-2 text-sm font-medium text-emerald-700"
          role="status"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {successMessage}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSaving || Boolean(successMessage)}
      >
        {isSaving ? 'Saving…' : successMessage ? 'Saved' : 'Save page'}
      </Button>
    </form>
  )
}
