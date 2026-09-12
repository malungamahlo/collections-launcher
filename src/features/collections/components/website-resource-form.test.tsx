// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestCollection } from '../test/collection.fixtures'
import { WebsiteResourceForm } from './website-resource-form'

afterEach(cleanup)

describe('WebsiteResourceForm', () => {
  it('renders website fields, destination collections, and actions', () => {
    const collection = createTestCollection()

    render(
      <WebsiteResourceForm
        values={{ name: '', url: '', collectionId: collection.id }}
        collections={[collection]}
        submitLabel="Add resource"
        onValuesChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    )

    expect(
      screen.getByRole('textbox', { name: 'Resource name' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('textbox', { name: 'Resource URL' }),
    ).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Collection' })).toBeTruthy()
    expect(screen.getByRole('option', { name: collection.name })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add resource' })).toBeTruthy()
  })

  it('focuses the URL field when it is the first invalid field', async () => {
    const user = userEvent.setup()
    const collection = createTestCollection()
    const props = {
      values: {
        name: 'Example',
        url: 'invalid',
        collectionId: collection.id,
      },
      collections: [collection],
      submitLabel: 'Add resource',
      onValuesChange: () => undefined,
      onSubmit: () => undefined,
      onCancel: () => undefined,
    }
    const { rerender } = render(<WebsiteResourceForm {...props} />)
    const urlInput = screen.getByRole('textbox', { name: 'Resource URL' })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    rerender(
      <WebsiteResourceForm
        {...props}
        urlError="Enter a valid resource URL."
      />,
    )

    await waitFor(() => expect(document.activeElement).toBe(urlInput))
  })
})
