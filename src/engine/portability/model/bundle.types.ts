/** Identifies the bundle document format inside an exported file. */
export const BUNDLE_FORMAT = 'collections-launcher' as const

/**
 * Identifies the shape of an exported bundle.
 * Increment this value when a future change requires a bundle migration.
 */
export const BUNDLE_SCHEMA_VERSION = 1 as const

/** File extension used for exported and imported bundle files. */
export const BUNDLE_FILE_EXTENSION = '.collectionLauncher' as const

/** A website resource as it appears inside a bundle, stripped of local identifiers. */
export interface BundleResource {
  readonly name: string
  readonly url: string
}

/** A collection as it appears inside a bundle, stripped of local identifiers. */
export interface BundleCollection {
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly resources: readonly BundleResource[]
}

/** The portable document produced by exporting a single collection. */
export interface CollectionBundle {
  readonly format: typeof BUNDLE_FORMAT
  readonly schemaVersion: typeof BUNDLE_SCHEMA_VERSION
  readonly exportedAt: string
  readonly collection: BundleCollection
}
