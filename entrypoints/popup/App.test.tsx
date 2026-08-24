// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import type { CollectionsRepository } from '@app/features/collections/storage/collections.repository'
import {
  createTestCollection,
  createTestState,
} from '@app/features/collections/test/collection.fixtures'
import type { ActiveTabAdapter } from '@app/platform/browser/active-tab.adapter'
import App from './App'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Creates a controllable repository for popup interaction tests. */
function createRepository(state: CollectionsState): {
  readonly repository: CollectionsRepository
  readonly save: ReturnType<typeof vi.fn<CollectionsRepository['save']>>
} {
  const save = vi
    .fn<CollectionsRepository['save']>()
    .mockResolvedValue(undefined)

  return {
    save,
    repository: {
      load: vi.fn().mockResolvedValue(state),
      save,
      subscribe: vi.fn().mockReturnValue(() => undefined),
    },
  }
}

/** Creates an adapter result for a normal saveable website. */
function createAvailableTabAdapter(): ActiveTabAdapter {
  return {
    getActivePage: vi.fn().mockResolvedValue({
      status: 'available',
      page: {
        title: 'Example documentation',
        url: 'https://example.com/docs',
      },
    }),
  }
}

describe('toolbar popup', () => {
  it('displays the page and saves an edited name to a selected collection', async () => {
    const user = userEvent.setup()
    const development = createTestCollection()
    const research = createTestCollection({
      id: 'collection-2',
      name: 'Research',
    })
    const state = createTestState({
      collections: [development, research],
    })
    const { repository, save } = createRepository(state)

    render(
      <App
        repository={repository}
        tabAdapter={createAvailableTabAdapter()}
      />,
    )

    const nameInput = await screen.findByLabelText<HTMLInputElement>(
      'Friendly name',
    )
    expect(nameInput.value).toBe('Example documentation')
    expect(screen.getByLabelText(/Active page URL/).textContent).toContain(
      'https://example.com/docs',
    )

    await user.clear(nameInput)
    await user.type(nameInput, 'Example docs')
    await user.selectOptions(
      screen.getByLabelText('Save to collection'),
      research.id,
    )
    await user.tab()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0].collections[1]?.resources[0]).toMatchObject({
      name: 'Example docs',
      url: 'https://example.com/docs',
    })
    expect((await screen.findByRole('status')).textContent).toContain(
      'Saved to Research.',
    )
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Saved' })
        .disabled,
    ).toBe(true)
  })

  it('reveals quick collection creation when no collection exists', async () => {
    const state = createTestState()
    const { repository } = createRepository(state)

    render(
      <App
        repository={repository}
        tabAdapter={createAvailableTabAdapter()}
      />,
    )

    expect(await screen.findByLabelText('New collection name')).toBeTruthy()
    expect(
      screen.getByLabelText<HTMLSelectElement>('Save to collection').value,
    ).toBe('__new_collection__')
  })

  it('explains that internal browser pages cannot be saved', async () => {
    const { repository } = createRepository(createTestState())
    const tabAdapter: ActiveTabAdapter = {
      getActivePage: vi.fn().mockResolvedValue({
        status: 'unavailable',
        reason: 'unsupported-url',
      }),
    }

    render(<App repository={repository} tabAdapter={tabAdapter} />)

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This browser page cannot be saved.',
    )
    expect(screen.queryByRole('button', { name: 'Save page' })).toBeNull()
  })

  it('reports active-tab failures without rendering the form', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { repository } = createRepository(createTestState())
    const tabAdapter: ActiveTabAdapter = {
      getActivePage: vi
        .fn()
        .mockRejectedValue(new Error('Tab query failed')),
    }

    render(<App repository={repository} tabAdapter={tabAdapter} />)

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The active page could not be read.',
    )
    expect(consoleError).toHaveBeenCalled()
  })
})
