import { z } from 'zod'
import { COLLECTION_NAME_MAX_LENGTH } from '@app/features/collections/model/collection.validation'
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION } from '../model/bundle.types'

/**
 * Structural-safety cap on a bundle collection's description length. No
 * domain-level limit exists for description today (manual collection
 * editing leaves it unbounded); this exists only to keep a hostile or
 * corrupted file's memory footprint bounded before anything else runs.
 */
export const MAX_BUNDLE_DESCRIPTION_LENGTH = 2_000

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
