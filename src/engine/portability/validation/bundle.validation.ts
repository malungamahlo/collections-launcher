import { getCollectionNameValidationError } from '@app/features/collections/model/collection.validation'
import {
  getWebsiteNameValidationError,
  getWebsiteUrlValidationError,
  normalizeWebsiteName,
} from '@app/features/collections/model/website-resource.validation'
import { normalizeWebsiteUrl } from '@app/features/collections/model/website-url'
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  type BundleResource,
  type CollectionBundle,
} from '../model/bundle.types'
import { collectionBundleSchema } from './bundle.schema'

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
