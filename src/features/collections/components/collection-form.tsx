import { useId, type FormEvent } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Input } from '@app/shared/components/ui/input'
import { Select } from '@app/shared/components/ui/select'
import { Textarea } from '@app/shared/components/ui/textarea'
import type { CollectionFormValues } from './collection-form.types'

interface CollectionFormProps {
  readonly values: CollectionFormValues
  readonly submitLabel: string
  readonly isSubmitting?: boolean
  readonly nameError?: string
  readonly submissionError?: string
  readonly onValuesChange: (values: CollectionFormValues) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}

/**
 * Edits collection metadata while its parent owns workflow and persistence state.
 */
export function CollectionForm({
  values,
  submitLabel,
  isSubmitting = false,
  nameError,
  submissionError,
  onValuesChange,
  onSubmit,
  onCancel,
}: CollectionFormProps) {
  const formId = useId()
  const nameId = `${formId}-name`
  const nameErrorId = `${formId}-name-error`
  const descriptionId = `${formId}-description`
  const iconId = `${formId}-icon`
  const colorId = `${formId}-color`

  /** Prevents page navigation and delegates submission to the parent workflow. */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <label
          className="text-sm font-medium text-card-foreground"
          htmlFor={nameId}
        >
          Collection name
        </label>
        <Input
          id={nameId}
          name="name"
          value={values.name}
          placeholder="For example, Development"
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
        <label
          className="text-sm font-medium text-card-foreground"
          htmlFor={descriptionId}
        >
          Description
        </label>
        <Textarea
          id={descriptionId}
          name="description"
          value={values.description}
          placeholder="What resources belong in this collection?"
          disabled={isSubmitting}
          onChange={event =>
            onValuesChange({ ...values, description: event.target.value })
          }
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Optional. Add a short reminder of what this collection is for.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-card-foreground"
            htmlFor={iconId}
          >
            Icon
          </label>
          <Select
            id={iconId}
            name="icon"
            value={values.icon}
            disabled={isSubmitting}
            onChange={event =>
              onValuesChange({ ...values, icon: event.target.value })
            }
          >
            <option value="folder">Folder</option>
            <option value="code">Code</option>
            <option value="cloud">Cloud</option>
            <option value="search">Search</option>
          </Select>
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-card-foreground"
            htmlFor={colorId}
          >
            Color
          </label>
          <Input
            id={colorId}
            name="color"
            type="color"
            value={values.color}
            className="w-full cursor-pointer p-1 sm:w-16"
            aria-label="Collection color"
            disabled={isSubmitting}
            onChange={event =>
              onValuesChange({ ...values, color: event.target.value })
            }
          />
        </div>
      </div>

      {submissionError && (
        <p className="text-sm text-red-700" role="alert">
          {submissionError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
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
