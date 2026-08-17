// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '../model/collection.types'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { useResourceMove } from './use-resource-move'

afterEach(() => {
  cleanup()
})

describe('useResourceMove', () => {
  it('saves the resource moved into the target collection at the given index', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const existing = createTestWebsiteResource({
      id: 'resource-1',
      name: 'Existing',
      url: 'https://existing.example.com/',
    })
    const source = createTestCollection({
      id: 'collection-1',
      resources: [moved],
    })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
      resources: [existing],
    })
    const state = createTestState({ collections: [source, target] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useResourceMove({ state, save }))

    await act(async () =>
      result.current.move('collection-1', 'collection-2', 'resource-moved', 0),
    )

    expect(save).toHaveBeenCalledOnce()
    const [savedSource, savedTarget] = save.mock.calls[0][0].collections
    expect(savedSource?.resources).toEqual([])
    expect(savedTarget?.resources).toEqual([moved, existing])
    expect(savedTarget?.updatedAt).toBe(2_000)
    vi.restoreAllMocks()
  })

  it('logs and does not throw when the move or save fails', async () => {
    const collection = createTestCollection({
      resources: [createTestWebsiteResource()],
    })
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() => useResourceMove({ state, save }))

    await expect(
      result.current.move('collection-1', 'missing-collection', 'resource-1', 0),
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
