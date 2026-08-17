import { moveResourceToPosition } from '../model/collection.operations'
import type {
  CollectionId,
  CollectionsState,
  ResourceId,
} from '../model/collection.types'

interface UseResourceMoveOptions {
  readonly state: CollectionsState
  readonly save: (state: CollectionsState) => Promise<void>
}

/** Persists a drag-and-drop move of a resource into a different collection. */
export function useResourceMove({ state, save }: UseResourceMoveOptions) {
  async function move(
    sourceCollectionId: CollectionId,
    targetCollectionId: CollectionId,
    resourceId: ResourceId,
    targetIndex: number,
  ): Promise<void> {
    try {
      const nextState = moveResourceToPosition(
        state,
        sourceCollectionId,
        targetCollectionId,
        resourceId,
        targetIndex,
        Date.now(),
      )

      await save(nextState)
    } catch (error) {
      console.error(
        `Could not move resource ${resourceId} from collection ${sourceCollectionId} to ${targetCollectionId}`,
        error,
      )
    }
  }

  return { move }
}
