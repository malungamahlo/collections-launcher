// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestCollection } from '../test/collection.fixtures'
import { FileResourceForm } from './file-resource-form'
import type { ChosenFileSummary } from './file-resource-form.types'

afterEach(() => {
  cleanup()
})

const collections = [
  createTestCollection({ id: 'first', name: 'Development' }),
  createTestCollection({ id: 'second', name: 'Research' }),
]

const chosenFile: ChosenFileSummary = {
  fileName: 'Employee handbook.pdf',
  kindLabel: 'PDF document',
  sizeBytes: 2_048,
}

function renderForm(
  overrides: Partial<Parameters<typeof FileResourceForm>[0]> = {},
) {
  const props = {
    values: { name: '', collectionId: 'first' },
    collections,
    onValuesChange: vi.fn(),
    onChooseFile: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }

  render(<FileResourceForm {...props} />)

  return props
}

function getButton(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement
}

describe('FileResourceForm', () => {
  describe('choosing a file', () => {
    it('offers "Choose file…" before anything is picked, and lists what is supported', () => {
      renderForm()

      expect(getButton('Choose file…')).not.toBeNull()
      expect(screen.getByText(/Supported: .*PDF document.*Word document/)).not.toBeNull()
      expect(screen.getByText(/up to 100 MB/)).not.toBeNull()
    })

    it('opens the picker when the button is clicked', async () => {
      const user = userEvent.setup()
      const { onChooseFile } = renderForm()

      await user.click(getButton('Choose file…'))

      expect(onChooseFile).toHaveBeenCalledOnce()
    })

    it('shows the chosen file’s name, kind, and size, and offers to change it', () => {
      renderForm({ chosenFile })

      expect(screen.getByText('Employee handbook.pdf')).not.toBeNull()
      expect(screen.getByText('PDF document · 2 KB')).not.toBeNull()
      expect(getButton('Choose a different file')).not.toBeNull()
      expect(screen.getByText(/saves a link to it/)).not.toBeNull()
    })

    it('shows a file error as an alert in place of the hint', () => {
      renderForm({ fileError: 'Files must be 100 MB or smaller.' })

      expect(screen.getByRole('alert').textContent).toBe(
        'Files must be 100 MB or smaller.',
      )
      expect(screen.queryByText(/Supported:/)).toBeNull()
    })

    it('disables choosing, and says so, while the picker is open', () => {
      renderForm({ isPicking: true })

      expect(getButton('Choosing…').disabled).toBe(true)
      expect(getButton('Add file').disabled).toBe(true)
    })
  })

  describe('naming and placing it', () => {
    it('shows the name and reports edits with the other values kept', async () => {
      const user = userEvent.setup()
      const { onValuesChange } = renderForm({
        values: { name: 'Handbook', collectionId: 'first' },
      })

      await user.type(screen.getByLabelText('Resource name'), '!')

      expect(onValuesChange).toHaveBeenLastCalledWith({
        name: 'Handbook!',
        collectionId: 'first',
      })
    })

    it('offers every collection and reports a change of destination', async () => {
      const user = userEvent.setup()
      const { onValuesChange } = renderForm()

      await user.selectOptions(screen.getByLabelText('Collection'), 'second')

      expect(onValuesChange).toHaveBeenCalledWith({
        name: '',
        collectionId: 'second',
      })
      expect(
        Array.from((screen.getByLabelText('Collection') as HTMLSelectElement).options).map(
          option => option.textContent,
        ),
      ).toEqual(['Development', 'Research'])
    })

    it('shows a name error next to the field and marks it invalid', () => {
      renderForm({ nameError: 'Enter a resource name.' })

      expect(screen.getByText('Enter a resource name.')).not.toBeNull()
      expect(screen.getByLabelText('Resource name').getAttribute('aria-invalid')).toBe(
        'true',
      )
    })
  })

  describe('submitting', () => {
    it('submits with "Add file"', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderForm({ chosenFile })

      await user.click(getButton('Add file'))

      expect(onSubmit).toHaveBeenCalledOnce()
    })

    it('shows a submission error as an alert', () => {
      renderForm({ submissionError: 'The file could not be added. Try again.' })

      expect(screen.getByRole('alert').textContent).toBe(
        'The file could not be added. Try again.',
      )
    })

    it('locks the form and shows "Adding…" while saving', () => {
      renderForm({ chosenFile, isSubmitting: true })

      expect(getButton('Adding…').disabled).toBe(true)
      expect(getButton('Cancel').disabled).toBe(true)
      expect(getButton('Choose a different file').disabled).toBe(true)
      expect((screen.getByLabelText('Resource name') as HTMLInputElement).disabled).toBe(
        true,
      )
    })

    it('cancels', async () => {
      const user = userEvent.setup()
      const { onCancel } = renderForm()

      await user.click(getButton('Cancel'))

      expect(onCancel).toHaveBeenCalledOnce()
    })
  })
})
