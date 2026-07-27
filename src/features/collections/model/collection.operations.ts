import type {
  Collection,
  CollectionId,
  CollectionResource,
  CollectionsState,
  ResourceId,
  Timestamp,
} from './collection.types'

/** Stable error categories that presentation code can handle later. */
export type CollectionOperationErrorCode =
  | 'COLLECTION_NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  | 'DUPLICATE_COLLECTION_ID'
  | 'DUPLICATE_RESOURCE_ID'

/**
 * Identifies a predictable failure while changing collection state.
 */
export class CollectionOperationError extends Error {
  constructor(
    readonly code: CollectionOperationErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CollectionOperationError'
  }
}

/**
 * Finds a collection or throws a typed error when its ID is unknown.
 */
function findCollection(
  state: CollectionsState,
  collectionId: CollectionId,
): Collection {
  const collection = state.collections.find(
    candidate => candidate.id === collectionId,
  )

  if (!collection) {
    throw new CollectionOperationError(
      'COLLECTION_NOT_FOUND',
      `Collection "${collectionId}" was not found`,
    )
  }

  return collection
}

/**
 * Finds a resource inside a collection or throws a typed error.
 */
function findResource(
  collection: Collection,
  resourceId: ResourceId,
): CollectionResource {
  const resource = collection.resources.find(
    candidate => candidate.id === resourceId,
  )

  if (!resource) {
    throw new CollectionOperationError(
      'RESOURCE_NOT_FOUND',
      `Resource "${resourceId}" was not found in collection "${collection.id}"`,
    )
  }

  return resource
}

/**
 * Replaces one collection while preserving the order of all collections.
 */
function replaceCollection(
  state: CollectionsState,
  replacement: Collection,
): CollectionsState {
  return {
    ...state,
    collections: state.collections.map(collection =>
      collection.id === replacement.id ? replacement : collection,
    ),
  }
}

/**
 * Rejects a resource ID when it already exists anywhere in the state.
 */
function ensureUniqueResourceId(
  state: CollectionsState,
  resourceId: ResourceId,
): void {
  const alreadyExists = state.collections.some(collection =>
    collection.resources.some(resource => resource.id === resourceId),
  )

  if (alreadyExists) {
    throw new CollectionOperationError(
      'DUPLICATE_RESOURCE_ID',
      `Resource "${resourceId}" already exists`,
    )
  }
}

/**
 * Ensures a complete collection does not introduce repeated resource IDs.
 */
function ensureCollectionResourceIdsAreUnique(
  state: CollectionsState,
  collection: Collection,
): void {
  const knownResourceIds = new Set(
    state.collections
      .filter(existingCollection => existingCollection.id !== collection.id)
      .flatMap(existingCollection =>
        existingCollection.resources.map(resource => resource.id),
      ),
  )

  for (const resource of collection.resources) {
    if (knownResourceIds.has(resource.id)) {
      throw new CollectionOperationError(
        'DUPLICATE_RESOURCE_ID',
        `Resource "${resource.id}" already exists`,
      )
    }

    knownResourceIds.add(resource.id)
  }
}

/**
 * Adds a valid collection without changing the existing state object.
 */
export function addCollection(
  state: CollectionsState,
  collection: Collection,
): CollectionsState {
  const alreadyExists = state.collections.some(
    existingCollection => existingCollection.id === collection.id,
  )

  if (alreadyExists) {
    throw new CollectionOperationError(
      'DUPLICATE_COLLECTION_ID',
      `Collection "${collection.id}" already exists`,
    )
  }

  ensureCollectionResourceIdsAreUnique(state, collection)

  return {
    ...state,
    collections: [...state.collections, collection],
  }
}

/**
 * Replaces an existing collection with its updated valid representation.
 */
export function updateCollection(
  state: CollectionsState,
  collection: Collection,
): CollectionsState {
  findCollection(state, collection.id)
  ensureCollectionResourceIdsAreUnique(state, collection)

  return replaceCollection(state, collection)
}

/**
 * Removes a collection and all resources contained inside it.
 */
export function removeCollection(
  state: CollectionsState,
  collectionId: CollectionId,
): CollectionsState {
  findCollection(state, collectionId)

  return {
    ...state,
    collections: state.collections.filter(
      collection => collection.id !== collectionId,
    ),
  }
}

/**
 * Adds a resource and updates the parent collection timestamp.
 */
export function addResourceToCollection(
  state: CollectionsState,
  collectionId: CollectionId,
  resource: CollectionResource,
  timestamp: Timestamp,
): CollectionsState {
  const collection = findCollection(state, collectionId)
  ensureUniqueResourceId(state, resource.id)

  return replaceCollection(state, {
    ...collection,
    resources: [...collection.resources, resource],
    updatedAt: timestamp,
  })
}

/**
 * Replaces an existing resource and updates its parent collection timestamp.
 */
export function updateResourceInCollection(
  state: CollectionsState,
  collectionId: CollectionId,
  resource: CollectionResource,
  timestamp: Timestamp,
): CollectionsState {
  const collection = findCollection(state, collectionId)
  findResource(collection, resource.id)

  return replaceCollection(state, {
    ...collection,
    resources: collection.resources.map(existingResource =>
      existingResource.id === resource.id ? resource : existingResource,
    ),
    updatedAt: timestamp,
  })
}

/**
 * Removes a resource and updates its parent collection timestamp.
 */
export function removeResourceFromCollection(
  state: CollectionsState,
  collectionId: CollectionId,
  resourceId: ResourceId,
  timestamp: Timestamp,
): CollectionsState {
  const collection = findCollection(state, collectionId)
  findResource(collection, resourceId)

  return replaceCollection(state, {
    ...collection,
    resources: collection.resources.filter(
      resource => resource.id !== resourceId,
    ),
    updatedAt: timestamp,
  })
}

/**
 * Moves a resource between collections without mutating either collection.
 */
export function moveResource(
  state: CollectionsState,
  sourceCollectionId: CollectionId,
  targetCollectionId: CollectionId,
  resourceId: ResourceId,
  timestamp: Timestamp,
): CollectionsState {
  if (sourceCollectionId === targetCollectionId) {
    findResource(findCollection(state, sourceCollectionId), resourceId)
    return state
  }

  const sourceCollection = findCollection(state, sourceCollectionId)
  findCollection(state, targetCollectionId)

  const resource = findResource(sourceCollection, resourceId)
  const stateWithoutResource = removeResourceFromCollection(
    state,
    sourceCollectionId,
    resourceId,
    timestamp,
  )

  return addResourceToCollection(
    stateWithoutResource,
    targetCollectionId,
    resource,
    timestamp,
  )
}
