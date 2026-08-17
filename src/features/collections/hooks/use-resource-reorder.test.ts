// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '../model/collection.types'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { useResourceReorder } from './use-resource-reorder'

afterEach(() => {
  cleanup()
})

describe('useResourceReorder', () => {
  it('saves the collection with resources in the given order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const first = createTestWebsiteResource({ id: 'resource-1' })
    const second = createTestWebsiteResource({
      id: 'resource-2',
      name: 'Second',
      url: 'https://second.example.com/',
    })
    const collection = createTestCollection({ resources: [first, second] })
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useResourceReorder({ state, save }))

    await act(async () =>
      result.current.reorder(collection.id, ['resource-2', 'resource-1']),
    )

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0][0].collections[0]?.resources).toEqual([
      second,
      first,
    ])
    expect(save.mock.calls[0][0].collections[0]?.updatedAt).toBe(2_000)
    vi.restoreAllMocks()
  })

  it('logs and does not throw when the reorder or save fails', async () => {
    const collection = createTestCollection({
      resources: [createTestWebsiteResource()],
    })
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockRejectedValue(new Error('Storage unavailable'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() => useResourceReorder({ state, save }))

    await expect(
      result.current.reorder(collection.id, ['does-not-exist']),
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
