// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '@app/features/collections/model/collection.types'
import {
  createTestCollection,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import { BookmarkDestinationPicker } from './bookmark-destination-picker'

afterEach(() => {
  cleanup()
})

const collections = [
  createTestCollection({
    id: 'reference',
    name: 'Reference',
    resources: [createTestWebsiteResource()],
  }),
  createTestCollection({ id: 'reading', name: 'Reading list' }),
]

function renderPicker(
  overrides: Partial<{
    folderName: string
    collections: readonly Collection[]
    selectedTargetId: string
  }> = {},
) {
  const onSelectTarget = vi.fn()

  render(
    <BookmarkDestinationPicker
      folderName="Work"
      collections={collections}
      onSelectTarget={onSelectTarget}
      {...overrides}
    />,
  )

  return { onSelectTarget }
}

function getRadios(): HTMLInputElement[] {
  return screen.getAllByRole('radio') as HTMLInputElement[]
}

describe('BookmarkDestinationPicker', () => {
  it('lists a new collection first, then each existing collection', () => {
    renderPicker()

    const labels = getRadios().map(radio => radio.closest('label')?.textContent)

    expect(labels).toEqual([
      'New collectionnamed “Work”',
      'Reference1 resource',
      'Reading list0 resources',
    ])
  })

  it('selects "New collection" by default', () => {
    renderPicker()

    expect(getRadios().map(radio => radio.checked)).toEqual([true, false, false])
  })

  it('shows the currently selected existing collection', () => {
    renderPicker({ selectedTargetId: 'reading' })

    expect(getRadios().map(radio => radio.checked)).toEqual([false, false, true])
  })

  it('reports the chosen collection, and undefined when choosing a new one', async () => {
    const user = userEvent.setup()
    const { onSelectTarget } = renderPicker({ selectedTargetId: 'reference' })

    await user.click(screen.getByRole('radio', { name: /Reading list/ }))
    await user.click(screen.getByRole('radio', { name: /New collection/ }))

    expect(onSelectTarget).toHaveBeenNthCalledWith(1, 'reading')
    expect(onSelectTarget).toHaveBeenNthCalledWith(2, undefined)
  })

  it('falls back to a readable name for an untitled folder', () => {
    renderPicker({ folderName: '' })

    expect(screen.getByText('named “Untitled folder”')).not.toBeNull()
  })
})
