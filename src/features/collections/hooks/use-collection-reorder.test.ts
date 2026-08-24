// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '../model/collection.types'
import {
  createTestCollection,
  createTestState,
} from '../test/collection.fixtures'
import { useCollectionReorder } from './use-collection-reorder'

afterEach(() => {
  cleanup()
})

describe('useCollectionReorder', () => {
  it('saves the collections in the given order', async () => {
    const first = createTestCollection({ id: 'collection-1', name: 'First' })
    const second = createTestCollection({
      id: 'collection-2',
      name: 'Second',
    })
    const state = createTestState({ collections: [first, second] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useCollectionReorder({ state, save }))

    await act(async () =>
      result.current.reorder(['collection-2', 'collection-1']),
    )

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0][0].collections).toEqual([second, first])
  })

  it('logs and does not throw when the reorder or save fails', async () => {
    const state = createTestState({
      collections: [createTestCollection({ id: 'collection-1' })],
    })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() => useCollectionReorder({ state, save }))

    await expect(
      result.current.reorder(['collection-does-not-exist']),
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
