import { reorderResourcesInCollection } from '../model/collection.operations'
import type {
  Collection,
  CollectionsState,
  ResourceId,
} from '../model/collection.types'

interface UseResourceReorderOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/** Persists a drag-and-drop reorder of a collection's resources. */
export function useResourceReorder({ state, save }: UseResourceReorderOptions) {
  async function reorder(
    collection: Collection,
    orderedResourceIds: readonly ResourceId[],
  ): Promise<void> {
    try {
      const nextState = reorderResourcesInCollection(
        state,
        collection.id,
        orderedResourceIds,
        Date.now(),
      )

      await save(nextState)
    } catch (error) {
      console.error(
        `Could not reorder resources in collection ${collection.id}`,
        error,
      )
    }
  }

  return { reorder }
}
