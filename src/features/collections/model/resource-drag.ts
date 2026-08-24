import type { Collection, CollectionId, ResourceId } from './collection.types'

/** Prefix for the droppable ID standing in for a collection with no resources yet. */
export const EMPTY_COLLECTION_DROPPABLE_PREFIX = 'collection-empty-'

/** Builds the droppable ID for an empty collection's placeholder drop zone. */
export function emptyCollectionDroppableId(collectionId: CollectionId): string {
  return `${EMPTY_COLLECTION_DROPPABLE_PREFIX}${collectionId}`
}

/**
 * Finds which collection a dnd-kit droppable ID belongs to — either the
 * collection currently holding a resource with that ID, or the collection
 * an empty-placeholder droppable ID stands in for.
 */
export function findDragContainerId(
  droppableId: string,
  collections: readonly Collection[],
): CollectionId | undefined {
  if (droppableId.startsWith(EMPTY_COLLECTION_DROPPABLE_PREFIX)) {
    const collectionId = droppableId.slice(
      EMPTY_COLLECTION_DROPPABLE_PREFIX.length,
    )
    return collections.some(collection => collection.id === collectionId)
      ? collectionId
      : undefined
  }

  return collections.find(collection =>
    collection.resources.some(resource => resource.id === droppableId),
  )?.id
}

/**
 * Moves a resource from its current container into a different container's
 * resource list, for live drag preview only. Returns the input unchanged if
 * either container or the resource cannot be found.
 */
export function moveResourceBetweenContainers(
  collections: readonly Collection[],
  sourceCollectionId: CollectionId,
  targetCollectionId: CollectionId,
  resourceId: ResourceId,
  targetIndex: number,
): readonly Collection[] {
  const sourceCollection = collections.find(
    collection => collection.id === sourceCollectionId,
  )
  const targetCollection = collections.find(
    collection => collection.id === targetCollectionId,
  )
  const resource = sourceCollection?.resources.find(
    candidate => candidate.id === resourceId,
  )

  if (!sourceCollection || !targetCollection || !resource) {
    return collections
  }

  const nextTargetResources = [...targetCollection.resources]
  const clampedIndex = Math.max(
    0,
    Math.min(targetIndex, nextTargetResources.length),
  )
  nextTargetResources.splice(clampedIndex, 0, resource)

  return collections.map(collection => {
    if (collection.id === sourceCollectionId) {
      return {
        ...collection,
        resources: collection.resources.filter(
          candidate => candidate.id !== resourceId,
        ),
      }
    }

    if (collection.id === targetCollectionId) {
      return { ...collection, resources: nextTargetResources }
    }

    return collection
  })
}

/** The result of interpreting a completed drag against the original state. */
export type DragOutcome =
  | { readonly type: 'none' }
  | {
      readonly type: 'reorder'
      readonly collectionId: CollectionId
      readonly orderedResourceIds: readonly ResourceId[]
    }
  | {
      readonly type: 'move'
      readonly sourceCollectionId: CollectionId
      readonly targetCollectionId: CollectionId
      readonly resourceId: ResourceId
      readonly targetIndex: number
    }

/**
 * Determines whether a completed drag is a same-collection reorder or a
 * cross-collection move, and what the resulting order or position is.
 * `workingCollections` reflects any live cross-container preview already
 * applied; `originalCollections` is the state from before the drag began.
 */
export function resolveDragOutcome(params: {
  readonly originalCollections: readonly Collection[]
  readonly workingCollections: readonly Collection[]
  readonly activeResourceId: ResourceId
  readonly overId: string
}): DragOutcome {
  const {
    originalCollections,
    workingCollections,
    activeResourceId,
    overId,
  } = params

  const originalContainerId = findDragContainerId(
    activeResourceId,
    originalCollections,
  )
  const finalContainerId = findDragContainerId(
    activeResourceId,
    workingCollections,
  )

  if (!originalContainerId || !finalContainerId) {
    return { type: 'none' }
  }

  if (originalContainerId === finalContainerId) {
    const collection = originalCollections.find(
      candidate => candidate.id === originalContainerId,
    )

    if (!collection) {
      return { type: 'none' }
    }

    const resourceIds = collection.resources.map(resource => resource.id)
    const oldIndex = resourceIds.indexOf(activeResourceId)
    const overIndex = resourceIds.indexOf(overId)

    if (oldIndex === -1 || overIndex === -1 || oldIndex === overIndex) {
      return { type: 'none' }
    }

    const reordered = [...resourceIds]
    reordered.splice(oldIndex, 1)
    reordered.splice(overIndex, 0, activeResourceId)

    return {
      type: 'reorder',
      collectionId: originalContainerId,
      orderedResourceIds: reordered,
    }
  }

  const targetCollection = workingCollections.find(
    candidate => candidate.id === finalContainerId,
  )

  if (!targetCollection) {
    return { type: 'none' }
  }

  const targetIndex = targetCollection.resources.findIndex(
    resource => resource.id === activeResourceId,
  )

  return {
    type: 'move',
    sourceCollectionId: originalContainerId,
    targetCollectionId: finalContainerId,
    resourceId: activeResourceId,
    targetIndex: targetIndex === -1 ? targetCollection.resources.length : targetIndex,
  }
}
