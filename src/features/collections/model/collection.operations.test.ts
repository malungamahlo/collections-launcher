import { describe, expect, it } from 'vitest'
import {
  addCollection,
  addResourceToCollection,
  CollectionOperationError,
  moveResource,
  moveResourceToPosition,
  removeCollection,
  removeResourceFromCollection,
  reorderResourcesInCollection,
  updateCollection,
  updateResourceInCollection,
} from './collection.operations'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'

describe('collection operations', () => {
  it('adds a collection without mutating the original state', () => {
    const originalState = createTestState()
    const collection = createTestCollection()

    const result = addCollection(originalState, collection)

    expect(result.collections).toEqual([collection])
    expect(originalState.collections).toEqual([])
    expect(result).not.toBe(originalState)
  })

  it('rejects a duplicate collection ID', () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })

    expect(() => addCollection(state, collection)).toThrowError(
      expect.objectContaining({
        code: 'DUPLICATE_COLLECTION_ID',
      }),
    )
  })

  it('updates and removes a collection', () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const updatedCollection = {
      ...collection,
      name: 'Engineering',
      updatedAt: 2_000,
    }

    const updatedState = updateCollection(state, updatedCollection)
    const removedState = removeCollection(updatedState, collection.id)

    expect(updatedState.collections).toEqual([updatedCollection])
    expect(removedState.collections).toEqual([])
  })

  it('adds a resource and updates its parent timestamp', () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const resource = createTestWebsiteResource()

    const result = addResourceToCollection(
      state,
      collection.id,
      resource,
      2_000,
    )

    expect(result.collections[0]?.resources).toEqual([resource])
    expect(result.collections[0]?.updatedAt).toBe(2_000)
    expect(collection.resources).toEqual([])
  })

  it('rejects a duplicate normalized URL inside one collection', () => {
    const existingResource = createTestWebsiteResource()
    const duplicateResource = createTestWebsiteResource({
      id: 'resource-2',
      name: 'GitHub again',
    })
    const collection = createTestCollection({
      resources: [existingResource],
    })
    const state = createTestState({ collections: [collection] })

    expect(() =>
      addResourceToCollection(
        state,
        collection.id,
        duplicateResource,
        2_000,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_RESOURCE_URL' }),
    )
  })

  it('allows the same URL in different collections', () => {
    const resource = createTestWebsiteResource()
    const source = createTestCollection({ resources: [resource] })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
    })
    const state = createTestState({ collections: [source, target] })
    const repeatedResource = createTestWebsiteResource({
      id: 'resource-2',
    })

    const result = addResourceToCollection(
      state,
      target.id,
      repeatedResource,
      2_000,
    )

    expect(result.collections[1]?.resources).toEqual([repeatedResource])
  })

  it('updates and removes a resource', () => {
    const resource = createTestWebsiteResource()
    const collection = createTestCollection({ resources: [resource] })
    const state = createTestState({ collections: [collection] })
    const updatedResource = {
      ...resource,
      name: 'GitHub Projects',
      updatedAt: 2_000,
    }

    const updatedState = updateResourceInCollection(
      state,
      collection.id,
      updatedResource,
      2_000,
    )
    const removedState = removeResourceFromCollection(
      updatedState,
      collection.id,
      resource.id,
      3_000,
    )

    expect(updatedState.collections[0]?.resources).toEqual([updatedResource])
    expect(removedState.collections[0]?.resources).toEqual([])
    expect(removedState.collections[0]?.updatedAt).toBe(3_000)
  })

  it('moves a resource between collections immutably', () => {
    const resource = createTestWebsiteResource()
    const source = createTestCollection({ resources: [resource] })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
    })
    const state = createTestState({ collections: [source, target] })

    const result = moveResource(
      state,
      source.id,
      target.id,
      resource.id,
      2_000,
    )

    expect(result.collections[0]?.resources).toEqual([])
    expect(result.collections[1]?.resources).toEqual([resource])
    expect(result.collections[0]?.updatedAt).toBe(2_000)
    expect(result.collections[1]?.updatedAt).toBe(2_000)
    expect(source.resources).toEqual([resource])
    expect(target.resources).toEqual([])
  })

  it('returns the same state when moving within one collection', () => {
    const resource = createTestWebsiteResource()
    const collection = createTestCollection({ resources: [resource] })
    const state = createTestState({ collections: [collection] })

    const result = moveResource(
      state,
      collection.id,
      collection.id,
      resource.id,
      2_000,
    )

    expect(result).toBe(state)
  })

  it('rejects moving a URL into a collection that already contains it', () => {
    const resource = createTestWebsiteResource()
    const source = createTestCollection({ resources: [resource] })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
      resources: [
        createTestWebsiteResource({ id: 'resource-2', name: 'Duplicate' }),
      ],
    })
    const state = createTestState({ collections: [source, target] })

    expect(() =>
      moveResource(state, source.id, target.id, resource.id, 2_000),
    ).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_RESOURCE_URL' }),
    )
  })

  it('reorders resources and updates the parent timestamp', () => {
    const first = createTestWebsiteResource({ id: 'resource-1' })
    const second = createTestWebsiteResource({
      id: 'resource-2',
      name: 'Second',
      url: 'https://second.example.com/',
    })
    const third = createTestWebsiteResource({
      id: 'resource-3',
      name: 'Third',
      url: 'https://third.example.com/',
    })
    const collection = createTestCollection({
      resources: [first, second, third],
    })
    const state = createTestState({ collections: [collection] })

    const result = reorderResourcesInCollection(
      state,
      collection.id,
      ['resource-3', 'resource-1', 'resource-2'],
      2_000,
    )

    expect(result.collections[0]?.resources).toEqual([third, first, second])
    expect(result.collections[0]?.updatedAt).toBe(2_000)
    expect(collection.resources).toEqual([first, second, third])
  })

  it('rejects a reorder that omits or invents a resource ID', () => {
    const resource = createTestWebsiteResource()
    const collection = createTestCollection({ resources: [resource] })
    const state = createTestState({ collections: [collection] })

    expect(() =>
      reorderResourcesInCollection(
        state,
        collection.id,
        ['resource-does-not-exist'],
        2_000,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_RESOURCE_ORDER' }),
    )
  })

  it('rejects a reorder with a duplicated resource ID', () => {
    const first = createTestWebsiteResource({ id: 'resource-1' })
    const second = createTestWebsiteResource({
      id: 'resource-2',
      name: 'Second',
      url: 'https://second.example.com/',
    })
    const collection = createTestCollection({ resources: [first, second] })
    const state = createTestState({ collections: [collection] })

    expect(() =>
      reorderResourcesInCollection(
        state,
        collection.id,
        ['resource-1', 'resource-1'],
        2_000,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'INVALID_RESOURCE_ORDER' }),
    )
  })

  it('moves a resource into another collection at a specific position', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const source = createTestCollection({ resources: [moved] })
    const first = createTestWebsiteResource({
      id: 'resource-1',
      name: 'First',
      url: 'https://first.example.com/',
    })
    const second = createTestWebsiteResource({
      id: 'resource-2',
      name: 'Second',
      url: 'https://second.example.com/',
    })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
      resources: [first, second],
    })
    const state = createTestState({ collections: [source, target] })

    const result = moveResourceToPosition(
      state,
      source.id,
      target.id,
      moved.id,
      1,
      2_000,
    )

    expect(result.collections[0]?.resources).toEqual([])
    expect(result.collections[0]?.updatedAt).toBe(2_000)
    expect(result.collections[1]?.resources).toEqual([first, moved, second])
    expect(result.collections[1]?.updatedAt).toBe(2_000)
    expect(source.resources).toEqual([moved])
    expect(target.resources).toEqual([first, second])
  })

  it('clamps an out-of-range target index to the end of the target collection', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const source = createTestCollection({ resources: [moved] })
    const existing = createTestWebsiteResource({
      id: 'resource-1',
      name: 'Existing',
      url: 'https://existing.example.com/',
    })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
      resources: [existing],
    })
    const state = createTestState({ collections: [source, target] })

    const result = moveResourceToPosition(
      state,
      source.id,
      target.id,
      moved.id,
      99,
      2_000,
    )

    expect(result.collections[1]?.resources).toEqual([existing, moved])
  })

  it('rejects moving a URL into a collection that already contains it', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const source = createTestCollection({ resources: [moved] })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
      resources: [
        createTestWebsiteResource({ id: 'resource-2', name: 'Duplicate' }),
      ],
    })
    const state = createTestState({ collections: [source, target] })

    expect(() =>
      moveResourceToPosition(state, source.id, target.id, moved.id, 0, 2_000),
    ).toThrowError(
      expect.objectContaining({ code: 'DUPLICATE_RESOURCE_URL' }),
    )
  })

  it('rejects a move within the same collection', () => {
    const resource = createTestWebsiteResource()
    const collection = createTestCollection({ resources: [resource] })
    const state = createTestState({ collections: [collection] })

    expect(() =>
      moveResourceToPosition(
        state,
        collection.id,
        collection.id,
        resource.id,
        0,
        2_000,
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'SAME_COLLECTION_MOVE' }),
    )
  })

  it('throws a typed error for a missing collection', () => {
    expect(() =>
      removeCollection(createTestState(), 'missing'),
    ).toThrowError(CollectionOperationError)
  })
})
