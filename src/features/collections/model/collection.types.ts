/**
 * Identifies the shape of persisted collection data.
 * Increment this value when a future change requires a storage migration.
 */
export const COLLECTIONS_SCHEMA_VERSION = 1 as const

/** Stable identifier for a collection. */
export type CollectionId = string

/** Stable identifier for a resource stored inside a collection. */
export type ResourceId = string

/** Unix timestamp in milliseconds. */
export type Timestamp = number

/** A website that a user has saved as part of a collection. */
export interface WebsiteResource {
  readonly id: ResourceId
  readonly type: 'website'
  readonly name: string
  readonly url: string
  readonly iconUrl?: string
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

/**
 * The resource types that a collection can contain.
 * This alias can become a union when more resource types are introduced.
 */
export type CollectionResource = WebsiteResource

/** A named workspace containing related resources. */
export interface Collection {
  readonly id: CollectionId
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
  readonly resources: readonly CollectionResource[]
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

/** The complete versioned domain state persisted by the extension. */
export interface CollectionsState {
  readonly schemaVersion: typeof COLLECTIONS_SCHEMA_VERSION
  readonly collections: readonly Collection[]
}
