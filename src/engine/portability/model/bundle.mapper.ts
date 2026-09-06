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
 * only local identifiers and timestamps before it ever leaves the
 * extension. Every visual characteristic that isn't a local identifier —
 * name, description, icon, color — is included, so an imported collection
 * looks exactly like the one that was exported.
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
    ...(collection.icon ? { icon: collection.icon } : {}),
    ...(collection.color ? { color: collection.color } : {}),
    resources,
  }

  return {
    format: BUNDLE_FORMAT,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date(now()).toISOString(),
    collection: bundleCollection,
  }
}
