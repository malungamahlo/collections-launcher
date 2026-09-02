import type { Collection } from '@app/features/collections/model/collection.types'
import {
  BUNDLE_FORMAT,
  BUNDLE_SCHEMA_VERSION,
  type BundleCollection,
  type BundleResource,
  type CollectionBundle,
} from './bundle.types'

/**
 * Converts a stored collection into its portable bundle shape, stripping
 * local identifiers, timestamps, and UI-only metadata before it ever leaves
 * the extension.
 */
export function collectionToBundle(
  collection: Collection,
  now: () => number = Date.now,
): CollectionBundle {
  const resources: readonly BundleResource[] = collection.resources.map(
    (resource) => ({
      name: resource.name,
      url: resource.url,
    }),
  )

  const bundleCollection: BundleCollection = {
    name: collection.name,
    ...(collection.description
      ? { description: collection.description }
      : {}),
    resources,
  }

  return {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date(now()).toISOString(),
    collection: bundleCollection,
  }
}
