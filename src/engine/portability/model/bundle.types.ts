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
  readonly color?: string
  readonly resources: readonly BundleResource[]
}

/** The portable document produced by exporting a single collection. */
export interface CollectionBundle {
  readonly format: typeof BUNDLE_FORMAT
  readonly schemaVersion: typeof BUNDLE_SCHEMA_VERSION
  readonly exportedAt: string
  readonly collection: BundleCollection
}

// --- The package: a bundle that carries files -----------------------------------
//
// A `.collectionLauncher` file that can hold file resources is a zip: a
// manifest (the bundle document, at schema version 2) plus one attachment per
// file resource. See `plans/v3/04-attachment-bundle-format-decision.md`. The
// version 1 document above still imports; it is no longer what an export writes.

/** The schema version of a package's manifest. */
export const PACKAGE_SCHEMA_VERSION = 2 as const

/** Where the manifest sits inside a package. */
export const PACKAGE_MANIFEST_PATH = 'manifest.json'

/** The folder every attachment sits in, with its trailing slash. */
export const PACKAGE_ATTACHMENTS_FOLDER = 'attachments/'

const MEGABYTE = 1024 * 1024

/** The most a package's files may add up to. */
export const PACKAGE_MAX_TOTAL_BYTES = 500 * MEGABYTE

/**
 * The largest `.collectionLauncher` file that is read at all: the files plus
 * room for the manifest and the zip's own overhead.
 */
export const PACKAGE_MAX_ARCHIVE_BYTES = 520 * MEGABYTE

/** The largest manifest that is parsed. A real one is a few kilobytes. */
export const PACKAGE_MAX_MANIFEST_BYTES = MEGABYTE

/** The most entries a package's zip may hold. */
export const PACKAGE_MAX_ZIP_ENTRIES = 1_000

/** A website resource in a package manifest. */
export interface PackageWebsiteEntry {
  readonly type: 'website'
  readonly name: string
  readonly url: string
}

/** A file resource in a package manifest, pointing at its attachment. */
export interface PackageFileEntry {
  readonly type: 'file'
  readonly name: string
  readonly mimeType: string
  /** The attachment's size in bytes, checked against the real bytes on import. */
  readonly sizeBytes: number
  /** The SHA-256 of the attachment's bytes, as 64 lower-case hex digits. */
  readonly sha256: string
  /** The attachment's path inside the package, e.g. `attachments/0001.pdf`. */
  readonly attachment: string
}

/** A resource in a package manifest: the domain's website/file union, without local ids. */
export type PackageResourceEntry = PackageWebsiteEntry | PackageFileEntry

/** A collection as it appears in a package manifest. */
export interface PackageCollection {
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
  readonly resources: readonly PackageResourceEntry[]
}

/** `manifest.json`: everything about an exported collection except its files' bytes. */
export interface CollectionPackageManifest {
  readonly format: typeof BUNDLE_FORMAT
  readonly schemaVersion: typeof PACKAGE_SCHEMA_VERSION
  readonly exportedAt: string
  readonly collection: PackageCollection
}
