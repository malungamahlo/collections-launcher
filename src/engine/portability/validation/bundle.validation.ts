import { getCollectionNameValidationError } from '@app/features/collections/model/collection.validation'
import {
  getWebsiteNameValidationError,
  getWebsiteUrlValidationError,
  normalizeWebsiteName,
} from '@app/features/collections/model/website-resource.validation'
import { normalizeWebsiteUrl } from '@app/features/collections/model/website-url'
import {
  normalizeMimeType,
  UNKNOWN_MIME_TYPE,
} from '@app/features/collections/model/resource-kind-registry'
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  PACKAGE_SCHEMA_VERSION,
  type BundleResource,
  type CollectionBundle,
  type CollectionPackageManifest,
  type PackageResourceEntry,
} from '../model/bundle.types'
import {
  collectionBundleSchema,
  collectionPackageManifestSchema,
} from './bundle.schema'

/** Every possible outcome of parsing untrusted bundle file text. */
export type ParseImportedBundleResult =
  | { readonly status: 'valid'; readonly bundle: CollectionBundle }
  | { readonly status: 'malformed' }
  | { readonly status: 'unsupported-format' }
  | { readonly status: 'unsupported-version'; readonly schemaVersion?: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parses and structurally validates untrusted `.collectionLauncher` file
 * text. Never throws — every input maps to exactly one of the four
 * documented statuses. `valid` only means the envelope and collection
 * shape are trustworthy; individual resource entries still need
 * `filterValidBundleResources`.
 */
export function parseImportedBundleText(text: string): ParseImportedBundleResult {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(text)
  } catch {
    return { status: 'malformed' }
  }

  if (!isRecord(parsedJson)) {
    return { status: 'malformed' }
  }

  if (parsedJson.format !== BUNDLE_FORMAT) {
    return { status: 'unsupported-format' }
  }

  if (
    typeof parsedJson.schemaVersion === 'number' &&
    parsedJson.schemaVersion !== BUNDLE_SCHEMA_VERSION
  ) {
    return {
      status: 'unsupported-version',
      schemaVersion: parsedJson.schemaVersion,
    }
  }

  const structuralResult = collectionBundleSchema.safeParse(parsedJson)

  if (!structuralResult.success) {
    return { status: 'malformed' }
  }

  const bundle = structuralResult.data

  if (getCollectionNameValidationError(bundle.collection.name)) {
    return { status: 'malformed' }
  }

  return { status: 'valid', bundle }
}

/** The outcome of validating a bundle's raw resource entries. */
export interface FilterValidBundleResourcesResult {
  readonly validResources: readonly BundleResource[]
  readonly skippedInvalidCount: number
}

/**
 * Keeps only the resource entries whose name and URL both pass the same
 * field-level rules manual website creation already enforces, normalizing
 * each one the same way. An invalid entry is counted and dropped rather
 * than rejecting the whole import.
 */
export function filterValidBundleResources(
  rawResources: readonly BundleResource[],
): FilterValidBundleResourcesResult {
  const validResources: BundleResource[] = []
  let skippedInvalidCount = 0

  for (const resource of rawResources) {
    if (
      getWebsiteNameValidationError(resource.name) ||
      getWebsiteUrlValidationError(resource.url)
    ) {
      skippedInvalidCount += 1
      continue
    }

    validResources.push({
      name: normalizeWebsiteName(resource.name),
      url: normalizeWebsiteUrl(resource.url),
    })
  }

  return { validResources, skippedInvalidCount }
}

// --- The package manifest (schema version 2) ------------------------------------

/** Every possible outcome of parsing an untrusted package's `manifest.json`. */
export type ParsePackageManifestResult =
  | { readonly status: 'valid'; readonly manifest: CollectionPackageManifest }
  | { readonly status: 'malformed' }
  | { readonly status: 'unsupported-format' }
  | { readonly status: 'unsupported-version'; readonly schemaVersion?: number }

/**
 * Parses and structurally validates the text of a package's `manifest.json`.
 * Never throws; the statuses mean what they do for `parseImportedBundleText`.
 *
 * `valid` means the envelope, the collection, and every file entry's
 * attachment path and hash are well-formed, and that no two file entries
 * name the same attachment. It says nothing yet about the attachments
 * themselves (the reader checks those against the zip), and individual
 * entries' names and URLs still need `filterValidPackageEntries`.
 */
export function parsePackageManifestText(text: string): ParsePackageManifestResult {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(text)
  } catch {
    return { status: 'malformed' }
  }

  if (!isRecord(parsedJson)) {
    return { status: 'malformed' }
  }

  if (parsedJson.format !== BUNDLE_FORMAT) {
    return { status: 'unsupported-format' }
  }

  if (
    typeof parsedJson.schemaVersion === 'number' &&
    parsedJson.schemaVersion !== PACKAGE_SCHEMA_VERSION
  ) {
    return {
      status: 'unsupported-version',
      schemaVersion: parsedJson.schemaVersion,
    }
  }

  const structuralResult = collectionPackageManifestSchema.safeParse(parsedJson)

  if (!structuralResult.success) {
    return { status: 'malformed' }
  }

  const manifest = structuralResult.data

  if (getCollectionNameValidationError(manifest.collection.name)) {
    return { status: 'malformed' }
  }

  const attachments = manifest.collection.resources.flatMap(entry =>
    entry.type === 'file' ? [entry.attachment] : [],
  )

  // Two entries sharing one attachment is nothing this app writes.
  if (new Set(attachments).size !== attachments.length) {
    return { status: 'malformed' }
  }

  return { status: 'valid', manifest }
}

/** The outcome of validating a package manifest's resource entries one by one. */
export interface FilterValidPackageEntriesResult {
  readonly validEntries: readonly PackageResourceEntry[]
  readonly skippedInvalidCount: number
}

/**
 * Keeps only the entries that pass the field-level rules a resource added by
 * hand must pass, normalizing each the same way: a website's name and URL, a
 * file's name (the same rule) and its MIME type. An invalid entry is counted
 * and dropped rather than rejecting the whole import — the same policy as
 * `filterValidBundleResources`. A file entry dropped here still has its
 * attachment checked by the reader: that check is about the package's
 * integrity, not about one entry's name.
 */
export function filterValidPackageEntries(
  rawEntries: readonly PackageResourceEntry[],
): FilterValidPackageEntriesResult {
  const validEntries: PackageResourceEntry[] = []
  let skippedInvalidCount = 0

  for (const entry of rawEntries) {
    if (getWebsiteNameValidationError(entry.name)) {
      skippedInvalidCount += 1
      continue
    }

    if (entry.type === 'website') {
      if (getWebsiteUrlValidationError(entry.url)) {
        skippedInvalidCount += 1
        continue
      }

      validEntries.push({
        type: 'website',
        name: normalizeWebsiteName(entry.name),
        url: normalizeWebsiteUrl(entry.url),
      })
      continue
    }

    validEntries.push({
      ...entry,
      name: normalizeWebsiteName(entry.name),
      // An empty or parameterised type is stored the way a picked file's is.
      mimeType: normalizeMimeType(entry.mimeType) || UNKNOWN_MIME_TYPE,
    })
  }

  return { validEntries, skippedInvalidCount }
}
