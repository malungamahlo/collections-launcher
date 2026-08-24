import {
  COLLECTIONS_SCHEMA_VERSION,
  type Collection,
  type CollectionsState,
  type WebsiteResource,
} from '../model/collection.types'
import { getCollectionNameValidationError } from '../model/collection.validation'
import { getWebsiteNameValidationError } from '../model/website-resource.validation'

/** Outcomes produced when resolving a value read from browser storage. */
export type StoredStateStatus =
  | 'valid'
  | 'missing'
  | 'malformed'
  | 'unsupported-version'

/** A safe state and information about how the stored value was handled. */
export interface StoredStateResolution {
  readonly status: StoredStateStatus
  readonly state: CollectionsState
  readonly storedVersion?: number
}

/**
 * Creates a fresh, valid state for first use or safe recovery.
 */
export function createEmptyCollectionsState(): CollectionsState {
  return {
    schemaVersion: COLLECTIONS_SCHEMA_VERSION,
    collections: [],
  }
}

/**
 * Determines whether a runtime value is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Determines whether an optional property contains a string.
 */
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

/**
 * Determines whether a value is a valid stored timestamp.
 */
function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Determines whether a stored value is an HTTP or HTTPS URL.
 */
function isValidStoredWebsiteUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Determines whether an unknown value is a valid website resource.
 */
function isWebsiteResource(value: unknown): value is WebsiteResource {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    value.type === 'website' &&
    typeof value.name === 'string' &&
    getWebsiteNameValidationError(value.name) === undefined &&
    isValidStoredWebsiteUrl(value.url) &&
    isOptionalString(value.iconUrl) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

/**
 * Determines whether an unknown value is a valid collection.
 */
function isCollection(value: unknown): value is Collection {
  if (!isRecord(value) || !Array.isArray(value.resources)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.name === 'string' &&
    getCollectionNameValidationError(value.name) === undefined &&
    isOptionalString(value.description) &&
    isOptionalString(value.icon) &&
    isOptionalString(value.color) &&
    value.resources.every(isWebsiteResource) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

/**
 * Ensures collection and resource identifiers are unique across the state.
 */
function hasUniqueIdentifiers(collections: readonly Collection[]): boolean {
  const collectionIds = new Set<string>()
  const resourceIds = new Set<string>()

  for (const collection of collections) {
    if (collectionIds.has(collection.id)) {
      return false
    }

    collectionIds.add(collection.id)

    for (const resource of collection.resources) {
      if (resourceIds.has(resource.id)) {
        return false
      }

      resourceIds.add(resource.id)
    }
  }

  return true
}

/**
 * Determines whether an unknown value matches the current state schema.
 */
function isCollectionsState(value: unknown): value is CollectionsState {
  if (
    !isRecord(value) ||
    value.schemaVersion !== COLLECTIONS_SCHEMA_VERSION ||
    !Array.isArray(value.collections) ||
    !value.collections.every(isCollection)
  ) {
    return false
  }

  return hasUniqueIdentifiers(value.collections)
}

/**
 * Converts an unknown storage value into a safe current application state.
 */
export function resolveStoredCollectionsState(
  value: unknown,
): StoredStateResolution {
  const emptyState = createEmptyCollectionsState()

  if (value === undefined) {
    return {
      status: 'missing',
      state: emptyState,
    }
  }

  if (!isRecord(value)) {
    return {
      status: 'malformed',
      state: emptyState,
    }
  }

  if (
    typeof value.schemaVersion === 'number' &&
    value.schemaVersion !== COLLECTIONS_SCHEMA_VERSION
  ) {
    return {
      status: 'unsupported-version',
      state: emptyState,
      storedVersion: value.schemaVersion,
    }
  }

  if (!isCollectionsState(value)) {
    return {
      status: 'malformed',
      state: emptyState,
    }
  }

  return {
    status: 'valid',
    state: value,
  }
}
