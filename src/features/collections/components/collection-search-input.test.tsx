// @vitest-environment happy-dom

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollectionSearchInput } from './collection-search-input'

afterEach(() => {
  cleanup()
})

/** Mirrors real usage by keeping the query in local state as it changes. */
function ControlledSearchInput() {
  const [value, setValue] = useState('')
  return <CollectionSearchInput value={value} onChange={setValue} />
}

describe('CollectionSearchInput', () => {
  it('updates its value as the user types', async () => {
    const user = userEvent.setup()

    render(<ControlledSearchInput />)

    const input = screen.getByLabelText<HTMLInputElement>(
      'Search collections and websites',
    )
    await user.type(input, 'git')

    expect(input.value).toBe('git')
  })

  it('displays the current value', () => {
    render(<CollectionSearchInput value="research" onChange={vi.fn()} />)

    expect(
      screen.getByLabelText<HTMLInputElement>(
        'Search collections and websites',
      ).value,
    ).toBe('research')
  })
})
