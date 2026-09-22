// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTestCollection,
  createTestFileResource,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { CollectionCard } from './collection-card'
import { CollectionGrid } from './collection-grid'

afterEach(cleanup)

const website = createTestWebsiteResource({
  id: 'website-1',
  name: 'GitHub',
  url: 'https://github.com/',
})
const file = createTestFileResource({
  id: 'file-1',
  name: 'Handbook',
  mimeType: 'application/pdf',
})
const collection = createTestCollection({ resources: [website, file] })

describe('CollectionCard opening resources', () => {
  it('opens a website through the website handler, and a file through the file handler', async () => {
    const user = userEvent.setup()
    const onOpenResource = vi.fn()
    const onOpenFile = vi.fn()
    render(
      <CollectionCard
        collection={collection}
        onOpenResource={onOpenResource}
        onOpenFile={onOpenFile}
        onOpenAll={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open Handbook' }))

    expect(onOpenFile).toHaveBeenCalledExactlyOnceWith(file)
    expect(onOpenResource).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Open GitHub' }))

    expect(onOpenResource).toHaveBeenCalledExactlyOnceWith(website)
    expect(onOpenFile).toHaveBeenCalledTimes(1)
  })

  it('saves a copy of a file through its own handler, never a website', async () => {
    const user = userEvent.setup()
    const onSaveFile = vi.fn()
    render(
      <CollectionCard
        collection={collection}
        onOpenResource={() => undefined}
        onSaveFile={onSaveFile}
        onOpenAll={() => undefined}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Save a copy of Handbook' }),
    )

    expect(onSaveFile).toHaveBeenCalledExactlyOnceWith(file)
    // A website has nothing to save a copy of.
    expect(
      screen.queryByRole('button', { name: 'Save a copy of GitHub' }),
    ).toBeNull()
  })

  it('offers no save control when it is given no save handler', () => {
    render(
      <CollectionCard
        collection={collection}
        onOpenResource={() => undefined}
        onOpenAll={() => undefined}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Save a copy of Handbook' }),
    ).toBeNull()
  })

  it('leaves file rows display-only when it is given no file handler', () => {
    render(
      <CollectionCard
        collection={collection}
        onOpenResource={() => undefined}
        onOpenAll={() => undefined}
      />,
    )

    expect(screen.getByText('Handbook')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Open Handbook' })).toBeNull()
  })
})

describe('CollectionGrid opening files', () => {
  it('passes the file handler down to each card', async () => {
    const user = userEvent.setup()
    const onOpenFile = vi.fn()
    render(
      <CollectionGrid
        collections={[collection]}
        onOpenResource={() => undefined}
        onOpenFile={onOpenFile}
        onOpenAll={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open Handbook' }))

    expect(onOpenFile).toHaveBeenCalledExactlyOnceWith(file)
  })

  it('passes the save handler down to each card', async () => {
    const user = userEvent.setup()
    const onSaveFile = vi.fn()
    render(
      <CollectionGrid
        collections={[collection]}
        onOpenResource={() => undefined}
        onSaveFile={onSaveFile}
        onOpenAll={() => undefined}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Save a copy of Handbook' }),
    )

    expect(onSaveFile).toHaveBeenCalledExactlyOnceWith(file)
  })
})
