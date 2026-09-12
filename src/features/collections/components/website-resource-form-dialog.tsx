import type { RefObject } from 'react'
import { Dialog } from '@app/shared/components/ui/dialog'
import type { Collection } from '../model/collection.types'
import { WebsiteResourceForm } from './website-resource-form'
import type { WebsiteResourceFormValues } from './website-resource-form.types'

interface WebsiteResourceFormDialogProps {
  readonly mode: 'create' | 'edit'
  readonly values: WebsiteResourceFormValues
  readonly collections: readonly Collection[]
  readonly nameError?: string
  readonly urlError?: string
  readonly submissionError?: string
  readonly isSubmitting: boolean
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onValuesChange: (values: WebsiteResourceFormValues) => void
  readonly onSubmit: () => void
  readonly onClose: () => void
}

/** Presents the website form for create, edit, and move workflows. */
export function WebsiteResourceFormDialog({
  mode,
  values,
  collections,
  nameError,
  urlError,
  submissionError,
  isSubmitting,
  fallbackFocusRef,
  onValuesChange,
  onSubmit,
  onClose,
}: WebsiteResourceFormDialogProps) {
  const isCreateMode = mode === 'create'

  return (
    <Dialog
      title={isCreateMode ? 'Add a resource' : 'Edit resource'}
      description={
        isCreateMode
          ? 'Save a useful resource inside one of your collections.'
          : 'Update the resource or move it to another collection.'
      }
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      <WebsiteResourceForm
        values={values}
        collections={collections}
        submitLabel={isCreateMode ? 'Add resource' : 'Save changes'}
        nameError={nameError}
        urlError={urlError}
        submissionError={submissionError}
        isSubmitting={isSubmitting}
        onValuesChange={onValuesChange}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Dialog>
  )
}
