import { reorderResourcesInCollection } from '../model/collection.operations'
import type {
  CollectionId,
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
    collectionId: CollectionId,
    orderedResourceIds: readonly ResourceId[],
  ): Promise<void> {
    try {
      const nextState = reorderResourcesInCollection(
        state,
        collectionId,
        orderedResourceIds,
        Date.now(),
      )

      await save(nextState)
    } catch (error) {
      console.error(
        `Could not reorder resources in collection ${collectionId}`,
        error,
      )
    }
  }

  return { reorder }
}
