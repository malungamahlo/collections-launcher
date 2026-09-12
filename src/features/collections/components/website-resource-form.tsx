import { useEffect, useId, useRef, type FormEvent } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Input } from '@app/shared/components/ui/input'
import { Label } from '@app/shared/components/ui/label'
import { Select } from '@app/shared/components/ui/select'
import type { Collection } from '../model/collection.types'
import type { WebsiteResourceFormValues } from './website-resource-form.types'

interface WebsiteResourceFormProps {
  readonly values: WebsiteResourceFormValues
  readonly collections: readonly Collection[]
  readonly submitLabel: string
  readonly nameError?: string
  readonly urlError?: string
  readonly submissionError?: string
  readonly isSubmitting?: boolean
  readonly onValuesChange: (values: WebsiteResourceFormValues) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

/**
 * Edits friendly website metadata and its destination collection.
 */
export function WebsiteResourceForm({
  values,
  collections,
  submitLabel,
  nameError,
  urlError,
  submissionError,
  isSubmitting = false,
  onValuesChange,
  onSubmit,
  onCancel,
}: WebsiteResourceFormProps) {
  const formId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const nameId = `${formId}-name`
  const nameErrorId = `${formId}-name-error`
  const urlId = `${formId}-url`
  const urlErrorId = `${formId}-url-error`
  const collectionId = `${formId}-collection`

  useEffect(() => {
    if (nameError) {
      nameInputRef.current?.focus()
    } else if (urlError) {
      urlInputRef.current?.focus()
    }
  }, [nameError, urlError])

  /** Prevents navigation and delegates the workflow to the parent hook. */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor={nameId}>Resource name</Label>
        <Input
          ref={nameInputRef}
          id={nameId}
          name="name"
          value={values.name}
          placeholder="For example, GitHub"
          autoComplete="off"
          autoFocus
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
        <Label htmlFor={urlId}>Resource URL</Label>
        <Input
          ref={urlInputRef}
          id={urlId}
          name="url"
          type="url"
          value={values.url}
          placeholder="github.com"
          autoComplete="url"
          required
          aria-invalid={urlError ? 'true' : undefined}
          aria-describedby={urlError ? urlErrorId : undefined}
          disabled={isSubmitting}
          onChange={event =>
            onValuesChange({ ...values, url: event.target.value })
          }
        />
        {urlError ? (
          <p id={urlErrorId} className="text-sm text-red-700">
            {urlError}
          </p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">
            HTTP and HTTPS addresses are supported. HTTPS is added when omitted.
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
        <Button
          variant="secondary"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
