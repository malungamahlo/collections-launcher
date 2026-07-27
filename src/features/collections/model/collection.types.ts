export const COLLECTIONS_SCHEMA_VERSION = 1 as const

export type CollectionId = string
export type ResourceId = string
export type Timestamp = number

export interface WebsiteResource {
  readonly id: ResourceId
  readonly type: 'website'
  readonly name: string
  readonly url: string
  readonly iconUrl?: string
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

export type CollectionResource = WebsiteResource

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

export interface CollectionsState {
  readonly schemaVersion: typeof COLLECTIONS_SCHEMA_VERSION
  readonly collections: readonly Collection[]
}
