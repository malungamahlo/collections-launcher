import { describe, expect, it } from 'vitest'
import {
  addCollection,
  addResourceToCollection,
  CollectionOperationError,
  moveResource,
  removeCollection,
  removeResourceFromCollection,
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

  it('throws a typed error for a missing collection', () => {
    expect(() =>
      removeCollection(createTestState(), 'missing'),
    ).toThrowError(CollectionOperationError)
  })
})
