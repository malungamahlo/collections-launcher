import { z } from 'zod'
import { COLLECTION_NAME_MAX_LENGTH } from '@app/features/collections/model/collection.validation'
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  PACKAGE_SCHEMA_VERSION,
} from '../model/bundle.types'
import { isValidAttachmentPath } from '../model/package-layout'

/**
 * Structural-safety cap on a bundle collection's description length. No
 * domain-level limit exists for description today (manual collection
 * editing leaves it unbounded); this exists only to keep a hostile or
 * corrupted file's memory footprint bounded before anything else runs.
 */
export const MAX_BUNDLE_DESCRIPTION_LENGTH = 2_000

/**
 * Structural-safety cap on a bundle collection's icon value. No domain-level
 * limit exists (the icon field itself is an unvalidated string; an
 * unrecognized value already falls back to the folder icon at render time),
 * so this exists only to bound a hostile string, generously.
 */
export const MAX_BUNDLE_ICON_LENGTH = 200

/**
 * Structural-safety cap on a bundle collection's color value. No
 * domain-level limit exists (color is an unvalidated string, typically a
 * hex code from a color `<input>`), so this exists only to bound a hostile
 * string, generously.
 */
export const MAX_BUNDLE_COLOR_LENGTH = 200

/**
 * Structural-safety cap on the number of resources a bundle can declare.
 * Individual resource name/URL correctness is checked later by
 * `filterValidBundleResources`, which reuses the real domain validators;
 * this cap only prevents a hostile file from declaring an unbounded array.
 */
export const MAX_BUNDLE_RESOURCES = 1_000

/**
 * Structural-safety cap on a single raw resource field, generous enough to
 * never reject anything `filterValidBundleResources` would otherwise
 * accept — it only bounds one hostile string.
 */
const MAX_RAW_RESOURCE_FIELD_LENGTH = 10_000

const bundleResourceSchema = z.object({
  name: z.string().max(MAX_RAW_RESOURCE_FIELD_LENGTH),
  url: z.string().max(MAX_RAW_RESOURCE_FIELD_LENGTH),
})

const bundleCollectionSchema = z.object({
  name: z.string().max(COLLECTION_NAME_MAX_LENGTH),
  description: z.string().max(MAX_BUNDLE_DESCRIPTION_LENGTH).optional(),
  icon: z.string().max(MAX_BUNDLE_ICON_LENGTH).optional(),
  color: z.string().max(MAX_BUNDLE_COLOR_LENGTH).optional(),
  resources: z.array(bundleResourceSchema).max(MAX_BUNDLE_RESOURCES),
})

/**
 * Validates a bundle's envelope and structure only — is this even a bundle
 * document, are its fields roughly the right shape and size. It does not
 * duplicate field-level domain rules (a collection name's emptiness, a
 * resource's URL validity); those are reused from the existing domain
 * validators in `bundle.validation.ts`. `format` and `schemaVersion` are
 * checked again here as literals, but `parseImportedBundleText` checks
 * them first and separately so a wrong format or unsupported version can
 * be reported as its own distinct status rather than collapsing into a
 * generic structural failure.
 */
export const collectionBundleSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  schemaVersion: z.literal(BUNDLE_SCHEMA_VERSION),
  exportedAt: z.string(),
  collection: bundleCollectionSchema,
})

// --- The package manifest (schema version 2) ------------------------------------

/** Structural-safety cap on a declared MIME type. Real ones are well under 100 characters. */
const MAX_MIME_TYPE_LENGTH = 255

const packageWebsiteEntrySchema = z.object({
  type: z.literal('website'),
  name: z.string().max(MAX_RAW_RESOURCE_FIELD_LENGTH),
  url: z.string().max(MAX_RAW_RESOURCE_FIELD_LENGTH),
})

const packageFileEntrySchema = z.object({
  type: z.literal('file'),
  name: z.string().max(MAX_RAW_RESOURCE_FIELD_LENGTH),
  mimeType: z.string().max(MAX_MIME_TYPE_LENGTH),
  // The per-file and per-package limits are checked against the zip itself,
  // where a clearer reason can be given; here a size only has to be a size.
  sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  // Only a path this app could have written; see `isValidAttachmentPath`.
  attachment: z.string().refine(isValidAttachmentPath),
})

const packageCollectionSchema = z.object({
  name: z.string().max(COLLECTION_NAME_MAX_LENGTH),
  description: z.string().max(MAX_BUNDLE_DESCRIPTION_LENGTH).optional(),
  icon: z.string().max(MAX_BUNDLE_ICON_LENGTH).optional(),
  color: z.string().max(MAX_BUNDLE_COLOR_LENGTH).optional(),
  resources: z
    .array(z.discriminatedUnion('type', [packageWebsiteEntrySchema, packageFileEntrySchema]))
    .max(MAX_BUNDLE_RESOURCES),
})

/**
 * Validates a package manifest's envelope and structure, the same way
 * `collectionBundleSchema` does for the version 1 document: is this a
 * manifest at all, and are its fields the right shape and a sane size. A
 * file entry's attachment path and SHA-256 are checked here because a
 * malformed one means the manifest was not written by this app — unlike a
 * resource's name or URL, which are checked entry by entry afterwards and
 * only skip that entry.
 */
export const collectionPackageManifestSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  schemaVersion: z.literal(PACKAGE_SCHEMA_VERSION),
  exportedAt: z.string(),
  collection: packageCollectionSchema,
})
