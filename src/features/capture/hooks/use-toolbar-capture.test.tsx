// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import type { ActivePage } from '@app/platform/browser/active-tab.adapter'
import { useToolbarCapture } from './use-toolbar-capture'

const ACTIVE_PAGE: ActivePage = {
  title: 'Example documentation',
  url: 'https://example.com/docs',
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Creates a typed successful persistence mock. */
function createSaveMock() {
  return vi
    .fn<(state: CollectionsState) => Promise<void>>()
    .mockResolvedValue(undefined)
}

describe('useToolbarCapture', () => {
  it('saves the active page into the first existing collection', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useToolbarCapture({ page: ACTIVE_PAGE, state, save }),
    )

    await act(async () => result.current.submit())

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0][0].collections[0]).toMatchObject({
      id: collection.id,
      updatedAt: 2_000,
      resources: [
        {
          name: ACTIVE_PAGE.title,
          url: ACTIVE_PAGE.url,
          createdAt: 2_000,
          updatedAt: 2_000,
        },
      ],
    })
    expect(result.current.successMessage).toBe('Saved to Development.')
  })

  it('creates a collection and resource together in one save', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const state = createTestState()
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useToolbarCapture({ page: ACTIVE_PAGE, state, save }),
    )

    act(() => {
      result.current.updateValues({
        ...result.current.values,
        name: '  Example docs  ',
        newCollectionName: '  Research  ',
      })
    })
    await act(async () => result.current.submit())

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0][0].collections).toHaveLength(1)
    expect(save.mock.calls[0][0].collections[0]).toMatchObject({
      name: 'Research',
      icon: 'folder',
      color: '#f97316',
      resources: [
        {
          name: 'Example docs',
          url: ACTIVE_PAGE.url,
        },
      ],
    })
    expect(result.current.successMessage).toBe('Saved to Research.')
  })

  it('validates the friendly name and new collection name', async () => {
    const state = createTestState()
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useToolbarCapture({ page: ACTIVE_PAGE, state, save }),
    )

    act(() => {
      result.current.updateValues({
        ...result.current.values,
        name: ' ',
        newCollectionName: ' ',
      })
    })
    await act(async () => result.current.submit())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.nameError).toBe('Enter a resource name.')
    expect(result.current.collectionError).toBe(
      'Enter a collection name.',
    )
  })

  it('reports duplicate URLs without losing entered values', async () => {
    const existingResource = createTestWebsiteResource({
      url: ACTIVE_PAGE.url,
    })
    const collection = createTestCollection({
      resources: [existingResource],
    })
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useToolbarCapture({ page: ACTIVE_PAGE, state, save }),
    )

    act(() => {
      result.current.updateValues({
        ...result.current.values,
        name: 'My custom name',
      })
    })
    await act(async () => result.current.submit())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.values.name).toBe('My custom name')
    expect(result.current.submissionError).toBe(
      'This resource is already saved in that collection.',
    )
  })

  it('preserves values and allows retry after storage fails', async () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockRejectedValue(new Error('Storage unavailable'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useToolbarCapture({ page: ACTIVE_PAGE, state, save }),
    )

    act(() => {
      result.current.updateValues({
        ...result.current.values,
        name: 'My example',
      })
    })
    await act(async () => result.current.submit())

    expect(result.current.values.name).toBe('My example')
    expect(result.current.submissionError).toBe(
      'The page could not be saved. Try again.',
    )
    expect(result.current.isSaving).toBe(false)
    expect(consoleError).toHaveBeenCalled()
  })
})
