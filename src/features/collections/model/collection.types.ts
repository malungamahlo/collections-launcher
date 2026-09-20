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

/**
 * The kinds of resource a collection can contain. Deliberately just two: a
 * specific *kind of file* (PDF, Markdown, Word…) is identified by
 * `FileResource.mimeType`, not by adding a member here, so supporting a new
 * file format never changes this union.
 */
export type ResourceType = 'website' | 'file'

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
 * A file a user has added to a collection. Only its metadata lives here: the
 * file's bytes are held by the file-content storage adapter, keyed by this
 * resource's own `id`, so there is no separate content reference to keep in
 * sync. What *kind* of file this is — and therefore how it is shown and
 * opened — is looked up from `mimeType` in the resource-kind registry.
 */
export interface FileResource {
  readonly id: ResourceId
  readonly type: 'file'
  readonly name: string
  /** An open-ended standard MIME type, e.g. `application/pdf`. */
  readonly mimeType: string
  /** The file's size in bytes when it was added. */
  readonly sizeBytes: number
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

/** The resources a collection can contain: a discriminated union on `type`. */
export type CollectionResource = WebsiteResource | FileResource

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
