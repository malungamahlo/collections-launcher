// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CollectionForm } from './collection-form'
import { EMPTY_COLLECTION_FORM_VALUES } from './collection-form.types'

afterEach(cleanup)

describe('CollectionForm interaction', () => {
  it('moves focus to the collection name when validation fails', async () => {
    const user = userEvent.setup()
    const props = {
      values: EMPTY_COLLECTION_FORM_VALUES,
      submitLabel: 'Create collection',
      onValuesChange: () => undefined,
      onSubmit: () => undefined,
      onCancel: () => undefined,
    }
    const { rerender } = render(<CollectionForm {...props} />)
    const nameInput = screen.getByRole('textbox', {
      name: 'Collection name',
    })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.activeElement).not.toBe(nameInput)

    rerender(
      <CollectionForm {...props} nameError="Enter a collection name." />,
    )

    await waitFor(() => expect(document.activeElement).toBe(nameInput))
  })
})
