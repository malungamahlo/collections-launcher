import type {
  CollectionsState,
  FileResource,
  ResourceId,
} from './collection.types'
import { isFileResource } from './resource.guards'

/**
 * Finds a file resource by id in whichever collection holds it. A website with
 * that id, or an id nothing has, yields `undefined`.
 */
export function findFileResourceById(
  state: CollectionsState,
  resourceId: ResourceId,
): FileResource | undefined {
  for (const collection of state.collections) {
    const resource = collection.resources.find(
      candidate => candidate.id === resourceId,
    )

    if (resource) {
      return isFileResource(resource) ? resource : undefined
    }
  }

  return undefined
}
