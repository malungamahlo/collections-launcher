import { describe, expect, it } from 'vitest'
import {
  createTestCollection,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import {
  emptyCollectionDroppableId,
  findDragContainerId,
  moveResourceBetweenContainers,
  resolveDragOutcome,
} from './resource-drag'

describe('findDragContainerId', () => {
  it('finds the collection holding a resource', () => {
    const resource = createTestWebsiteResource({ id: 'resource-1' })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [resource] }),
      createTestCollection({ id: 'collection-2', resources: [] }),
    ]

    expect(findDragContainerId('resource-1', collections)).toBe(
      'collection-1',
    )
  })

  it('resolves an empty-collection placeholder ID to that collection', () => {
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [] }),
    ]

    expect(
      findDragContainerId(
        emptyCollectionDroppableId('collection-1'),
        collections,
      ),
    ).toBe('collection-1')
  })

  it('returns undefined for an unknown droppable ID', () => {
    const collections = [createTestCollection({ id: 'collection-1' })]

    expect(findDragContainerId('does-not-exist', collections)).toBeUndefined()
  })
})

describe('moveResourceBetweenContainers', () => {
  it('moves a resource into another container at the given index', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const existing = createTestWebsiteResource({
      id: 'resource-1',
      name: 'Existing',
      url: 'https://existing.example.com/',
    })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [moved] }),
      createTestCollection({ id: 'collection-2', resources: [existing] }),
    ]

    const result = moveResourceBetweenContainers(
      collections,
      'collection-1',
      'collection-2',
      'resource-moved',
      0,
    )

    expect(result[0]?.resources).toEqual([])
    expect(result[1]?.resources).toEqual([moved, existing])
  })

  it('returns the input unchanged when the resource cannot be found', () => {
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [] }),
      createTestCollection({ id: 'collection-2', resources: [] }),
    ]

    const result = moveResourceBetweenContainers(
      collections,
      'collection-1',
      'collection-2',
      'does-not-exist',
      0,
    )

    expect(result).toBe(collections)
  })
})

describe('resolveDragOutcome', () => {
  it('resolves a same-collection drag as a reorder', () => {
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
    const collections = [
      createTestCollection({
        id: 'collection-1',
        resources: [first, second, third],
      }),
    ]

    const outcome = resolveDragOutcome({
      originalCollections: collections,
      workingCollections: collections,
      activeResourceId: 'resource-1',
      overId: 'resource-3',
    })

    expect(outcome).toEqual({
      type: 'reorder',
      collectionId: 'collection-1',
      orderedResourceIds: ['resource-2', 'resource-3', 'resource-1'],
    })
  })

  it('resolves a drag that crossed containers as a move', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const existing = createTestWebsiteResource({
      id: 'resource-1',
      name: 'Existing',
      url: 'https://existing.example.com/',
    })
    const originalCollections = [
      createTestCollection({ id: 'collection-1', resources: [moved] }),
      createTestCollection({ id: 'collection-2', resources: [existing] }),
    ]
    const workingCollections = moveResourceBetweenContainers(
      originalCollections,
      'collection-1',
      'collection-2',
      'resource-moved',
      0,
    )

    const outcome = resolveDragOutcome({
      originalCollections,
      workingCollections,
      activeResourceId: 'resource-moved',
      overId: 'resource-1',
    })

    expect(outcome).toEqual({
      type: 'move',
      sourceCollectionId: 'collection-1',
      targetCollectionId: 'collection-2',
      resourceId: 'resource-moved',
      targetIndex: 0,
    })
  })

  it('resolves a drag into a now-empty collection as a move to index 0', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const originalCollections = [
      createTestCollection({ id: 'collection-1', resources: [moved] }),
      createTestCollection({ id: 'collection-2', resources: [] }),
    ]
    const workingCollections = moveResourceBetweenContainers(
      originalCollections,
      'collection-1',
      'collection-2',
      'resource-moved',
      0,
    )

    const outcome = resolveDragOutcome({
      originalCollections,
      workingCollections,
      activeResourceId: 'resource-moved',
      overId: emptyCollectionDroppableId('collection-2'),
    })

    expect(outcome).toEqual({
      type: 'move',
      sourceCollectionId: 'collection-1',
      targetCollectionId: 'collection-2',
      resourceId: 'resource-moved',
      targetIndex: 0,
    })
  })

  it('resolves to none when dropped in the same position', () => {
    const resource = createTestWebsiteResource({ id: 'resource-1' })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [resource] }),
    ]

    const outcome = resolveDragOutcome({
      originalCollections: collections,
      workingCollections: collections,
      activeResourceId: 'resource-1',
      overId: 'resource-1',
    })

    expect(outcome).toEqual({ type: 'none' })
  })

  it('resolves to none when the active resource cannot be found anywhere', () => {
    const collections = [createTestCollection({ id: 'collection-1' })]

    const outcome = resolveDragOutcome({
      originalCollections: collections,
      workingCollections: collections,
      activeResourceId: 'does-not-exist',
      overId: 'resource-1',
    })

    expect(outcome).toEqual({ type: 'none' })
  })
})
