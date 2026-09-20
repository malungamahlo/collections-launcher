// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImportCollectionState } from '../hooks/use-import-collection'
import { ImportCollectionDialog } from './import-collection-dialog'

afterEach(() => {
  cleanup()
})

const previewingState: Extract<ImportCollectionState, { status: 'previewing' }> = {
  status: 'previewing',
  chosenName: 'Development',
  hasNameConflict: false,
  preview: {
    suggestedName: 'Development',
    description: 'Daily tools',
    hasNameConflict: false,
    resources: [{ name: 'GitHub', url: 'https://github.com/' }],
    skippedDuplicateCount: 0,
    skippedInvalidCount: 0,
  },
}

function renderDialog(
  importState: ImportCollectionState,
  overrides: Partial<{
    onChosenNameChange: () => void
    onConfirm: () => void
    onClose: () => void
  }> = {},
) {
  const onChosenNameChange = overrides.onChosenNameChange ?? vi.fn()
  const onConfirm = overrides.onConfirm ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()

  render(
    <ImportCollectionDialog
      importState={importState as Exclude<ImportCollectionState, { status: 'idle' }>}
      onChosenNameChange={onChosenNameChange}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )

  return { onChosenNameChange, onConfirm, onClose }
}

describe('ImportCollectionDialog', () => {
  it('shows the preview: name, description, resources, and no skip notice', () => {
    renderDialog(previewingState)

    expect(screen.getByDisplayValue('Development')).not.toBeNull()
    expect(screen.getByText('Daily tools')).not.toBeNull()
    expect(screen.getByText('1 resource')).not.toBeNull()
    expect(screen.getByText(/GitHub/)).not.toBeNull()
  })

  it('shows a name-conflict notice when hasNameConflict is true and there is no error', () => {
    renderDialog({ ...previewingState, hasNameConflict: true })

    expect(screen.getByText(/already exists/)).not.toBeNull()
  })

  it('disables the submit button while hasNameConflict is true, blocking the import', () => {
    renderDialog({ ...previewingState, hasNameConflict: true })

    const submitButton = screen.getByRole('button', {
      name: 'Import collection',
    }) as HTMLButtonElement

    expect(submitButton.disabled).toBe(true)
  })

  it('shows a name error instead of the conflict notice when both are present', () => {
    renderDialog({
      ...previewingState,
      hasNameConflict: true,
      nameError: 'Enter a collection name.',
    })

    expect(screen.getByText('Enter a collection name.')).not.toBeNull()
    expect(screen.queryByText(/already exists/)).toBeNull()
  })

  it('shows skipped-duplicate and skipped-invalid counts', () => {
    renderDialog({
      ...previewingState,
      preview: {
        ...previewingState.preview,
        skippedDuplicateCount: 2,
        skippedInvalidCount: 1,
      },
    })

    expect(screen.getByText(/2 duplicate resources skipped/)).not.toBeNull()
    expect(screen.getByText(/1 invalid resource skipped/)).not.toBeNull()
  })

  it('calls onChosenNameChange when the name field is edited', async () => {
    const user = userEvent.setup()
    const { onChosenNameChange } = renderDialog(previewingState)

    await user.type(screen.getByDisplayValue('Development'), 'X')

    expect(onChosenNameChange).toHaveBeenCalled()
  })

  it('calls onConfirm when the form is submitted', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog(previewingState)

    await user.click(screen.getByRole('button', { name: 'Import collection' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onClose when Cancel is clicked while previewing', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog(previewingState)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables the form and shows "Importing…" while importing', () => {
    renderDialog({
      status: 'importing',
      preview: previewingState.preview,
      chosenName: 'Development',
    })

    const submitButton = screen.getByRole('button', {
      name: 'Importing…',
    }) as HTMLButtonElement
    const nameInput = screen.getByDisplayValue('Development') as HTMLInputElement

    expect(submitButton.disabled).toBe(true)
    expect(nameInput.disabled).toBe(true)
  })

  it('shows the error state with a Close button', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({
      status: 'error',
      message: "This file isn't a Collections Launcher export.",
    })

    expect(
      screen.getByText("This file isn't a Collections Launcher export."),
    ).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the done state with the collection name and resource count', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({
      status: 'done',
      collectionName: 'Development',
      resourceCount: 3,
      addedToExisting: false,
    })

    expect(
      screen.getByText(/“Development” was added with 3 resources/),
    ).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  describe('when adding to an existing collection', () => {
    const mergeState: Extract<ImportCollectionState, { status: 'previewing' }> = {
      status: 'previewing',
      chosenName: 'Reference',
      hasNameConflict: false,
      preview: {
        target: { id: 'reference', name: 'Reference' },
        suggestedName: 'Reference',
        hasNameConflict: false,
        resources: [{ name: 'GitHub', url: 'https://github.com/' }],
        skippedDuplicateCount: 0,
        skippedInvalidCount: 0,
      },
    }

    it('names the target in the title and has no collection name field', () => {
      renderDialog(mergeState)

      expect(screen.getByText('Add to “Reference”')).not.toBeNull()
      expect(screen.queryByLabelText('Collection name')).toBeNull()
      expect(screen.queryByDisplayValue('Reference')).toBeNull()
    })

    it('lists the resources to add and confirms with "Add to collection"', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog(mergeState)

      expect(screen.getByText('1 resource')).not.toBeNull()
      expect(screen.getByText(/GitHub/)).not.toBeNull()

      await user.click(screen.getByRole('button', { name: 'Add to collection' }))

      expect(onConfirm).toHaveBeenCalledOnce()
    })

    it('shows the duplicate count for resources the collection already has', () => {
      renderDialog({
        ...mergeState,
        preview: { ...mergeState.preview, skippedDuplicateCount: 2 },
      })

      expect(screen.getByText(/2 duplicate resources skipped/)).not.toBeNull()
    })

    it('disables the submit button and explains why when there is nothing new to add', () => {
      renderDialog({
        ...mergeState,
        preview: {
          ...mergeState.preview,
          resources: [],
          skippedDuplicateCount: 3,
        },
      })

      const submitButton = screen.getByRole('button', {
        name: 'Add to collection',
      }) as HTMLButtonElement

      expect(submitButton.disabled).toBe(true)
      expect(
        screen.getByText('There’s nothing new to add to “Reference”.'),
      ).not.toBeNull()
    })

    it('shows "Adding…" and a disabled submit button while importing', () => {
      renderDialog({
        status: 'importing',
        preview: mergeState.preview,
        chosenName: 'Reference',
      })

      const submitButton = screen.getByRole('button', {
        name: 'Adding…',
      }) as HTMLButtonElement

      expect(submitButton.disabled).toBe(true)
    })

    it('shows the done state as resources added to the collection', () => {
      renderDialog({
        status: 'done',
        collectionName: 'Reference',
        resourceCount: 3,
        addedToExisting: true,
      })

      expect(
        screen.getByText(/3 resources were added to “Reference”/),
      ).not.toBeNull()
    })

    it('uses the singular form in the done state for one resource', () => {
      renderDialog({
        status: 'done',
        collectionName: 'Reference',
        resourceCount: 1,
        addedToExisting: true,
      })

      expect(
        screen.getByText(/1 resource was added to “Reference”/),
      ).not.toBeNull()
    })
  })
})
