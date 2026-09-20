import type { Collection } from '@app/features/collections/model/collection.types'
import { isWebsiteResource } from '@app/features/collections/model/resource.guards'
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
  // The bundle format is URL-only. File resources have no URL and their
  // content cannot be carried in a JSON bundle, so they are left out here —
  // an attachment-carrying format is Part 3 of V3.
  const resources: readonly BundleResource[] = collection.resources
    .filter(isWebsiteResource)
    .map(resource => ({
      name: resource.name,
      url: resource.url,
    }))

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
