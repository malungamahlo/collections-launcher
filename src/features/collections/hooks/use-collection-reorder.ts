import { reorderCollections } from '../model/collection.operations'
import type { CollectionId, CollectionsState } from '../model/collection.types'

interface UseCollectionReorderOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/** Persists a drag-and-drop reorder of the top-level collections list. */
export function useCollectionReorder({
  state,
  save,
}: UseCollectionReorderOptions) {
  async function reorder(
    orderedCollectionIds: readonly CollectionId[],
  ): Promise<void> {
    try {
      const nextState = reorderCollections(state, orderedCollectionIds)
      await save(nextState)
    } catch (error) {
      console.error('Could not reorder collections', error)
    }
  }

  return { reorder }
}
