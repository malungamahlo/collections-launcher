import { Dialog } from '@app/shared/components/ui/dialog'
import type { RefObject } from 'react'
import { CollectionForm } from './collection-form'
import type { CollectionFormValues } from './collection-form.types'

interface CollectionFormDialogProps {
  readonly mode: 'create' | 'edit'
  readonly values: CollectionFormValues
  readonly nameError?: string
  readonly submissionError?: string
  readonly isSubmitting: boolean
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onValuesChange: (values: CollectionFormValues) => void
  readonly onSubmit: () => void
  readonly onClose: () => void
}

/**
 * Presents the reusable collection form for create and edit workflows.
 */
export function CollectionFormDialog({
  mode,
  values,
  nameError,
  submissionError,
  isSubmitting,
  fallbackFocusRef,
  onValuesChange,
  onSubmit,
  onClose,
}: CollectionFormDialogProps) {
  const isCreateMode = mode === 'create'

  return (
    <Dialog
      title={isCreateMode ? 'Create a collection' : 'Edit collection'}
      description={
        isCreateMode
          ? 'Group websites that you use for the same purpose.'
          : 'Update how this collection appears on your dashboard.'
      }
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      <CollectionForm
        values={values}
        submitLabel={isCreateMode ? 'Create collection' : 'Save changes'}
        nameError={nameError}
        submissionError={submissionError}
        isSubmitting={isSubmitting}
        onValuesChange={onValuesChange}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Dialog>
  )
}
