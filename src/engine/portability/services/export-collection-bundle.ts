import type { Collection } from '@app/features/collections/model/collection.types'
import { collectionToBundle } from '../model/bundle.mapper'

/**
 * Produces the pretty-printed JSON text written to an exported
 * `.collectionLauncher` file. Key order is whatever `collectionToBundle`
 * builds its object literals in, which is stable across calls.
 */
export function serializeCollectionBundle(
  collection: Collection,
  now: () => number = Date.now,
): string {
  return JSON.stringify(collectionToBundle(collection, now), null, 2)
}
