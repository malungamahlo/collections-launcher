import { useState } from 'react'
import type { Collection, CollectionId } from '../model/collection.types'

interface UseCollectionDragOptions {
  readonly collections: readonly Collection[]
  readonly onReorder: (orderedCollectionIds: readonly CollectionId[]) => void
}

/** How long a just-reordered collection card stays highlighted. */
const HIGHLIGHT_MS = 900

/**
 * Coordinates reordering the collection cards themselves. Unlike a resource
 * drag, there is only ever one container (the grid), so no live
 * cross-container preview is needed — dnd-kit's own sortable tracking
 * already handles in-place visual reordering; this only needs to compute
 * and persist the final order once a drag completes.
 */
export function useCollectionDrag({
  collections,
  onReorder,
}: UseCollectionDragOptions) {
  const [highlightedCollectionId, setHighlightedCollectionId] =
    useState<CollectionId>()

  function handleDragEnd(activeId: string, overId: string | undefined): void {
    if (!overId || activeId === overId) {
      return
    }

    const collectionIds = collections.map(collection => collection.id)
    const oldIndex = collectionIds.indexOf(activeId)
    const overIndex = collectionIds.indexOf(overId)

    if (oldIndex === -1 || overIndex === -1) {
      return
    }

    const reordered = [...collectionIds]
    reordered.splice(oldIndex, 1)
    reordered.splice(overIndex, 0, activeId)

    onReorder(reordered)
    setHighlightedCollectionId(activeId)
    window.setTimeout(
      () => setHighlightedCollectionId(undefined),
      HIGHLIGHT_MS,
    )
  }

  return { highlightedCollectionId, handleDragEnd }
}
