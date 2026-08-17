import { useState } from 'react'
import type {
  Collection,
  CollectionId,
  ResourceId,
} from '../model/collection.types'
import {
  findDragContainerId,
  moveResourceBetweenContainers,
  resolveDragOutcome,
} from '../model/resource-drag'

interface UseResourceDragOptions {
  readonly collections: readonly Collection[]
  readonly onReorder: (
    collectionId: CollectionId,
    orderedResourceIds: readonly ResourceId[],
  ) => void
  readonly onMove: (
    sourceCollectionId: CollectionId,
    targetCollectionId: CollectionId,
    resourceId: ResourceId,
    targetIndex: number,
  ) => void
}

/** How long a just-dropped resource stays highlighted. */
const HIGHLIGHT_MS = 900

/**
 * Coordinates a resource drag across the whole collections grid: a live
 * preview while the drag crosses collection boundaries, and dispatching a
 * same-collection reorder or cross-collection move once it completes.
 */
export function useResourceDrag({
  collections,
  onReorder,
  onMove,
}: UseResourceDragOptions) {
  const [dragPreview, setDragPreview] = useState<readonly Collection[]>()
  const [highlightedResourceId, setHighlightedResourceId] =
    useState<ResourceId>()

  const renderedCollections = dragPreview ?? collections

  /** Live-previews a resource moving into a different collection's list. */
  function handleDragOver(activeId: string, overId: string | undefined): void {
    if (!overId) {
      return
    }

    const workingCollections = dragPreview ?? collections
    const activeContainerId = findDragContainerId(activeId, workingCollections)
    const overContainerId = findDragContainerId(overId, workingCollections)

    if (
      !activeContainerId ||
      !overContainerId ||
      activeContainerId === overContainerId
    ) {
      return
    }

    const targetCollection = workingCollections.find(
      collection => collection.id === overContainerId,
    )
    const overIndexInTarget =
      targetCollection?.resources.findIndex(
        resource => resource.id === overId,
      ) ?? -1

    setDragPreview(
      moveResourceBetweenContainers(
        workingCollections,
        activeContainerId,
        overContainerId,
        activeId,
        overIndexInTarget === -1 ? 0 : overIndexInTarget,
      ),
    )
  }

  /** Resolves the completed drag and persists a reorder or a move. */
  function handleDragEnd(activeId: string, overId: string | undefined): void {
    const workingCollections = dragPreview ?? collections
    setDragPreview(undefined)

    if (!overId) {
      return
    }

    const outcome = resolveDragOutcome({
      originalCollections: collections,
      workingCollections,
      activeResourceId: activeId,
      overId,
    })

    if (outcome.type === 'reorder') {
      onReorder(outcome.collectionId, outcome.orderedResourceIds)
      flashHighlight(activeId)
    } else if (outcome.type === 'move') {
      onMove(
        outcome.sourceCollectionId,
        outcome.targetCollectionId,
        outcome.resourceId,
        outcome.targetIndex,
      )
      flashHighlight(activeId)
    }
  }

  /** Cancels a drag in progress, discarding any live cross-container preview. */
  function cancelDrag(): void {
    setDragPreview(undefined)
  }

  function flashHighlight(resourceId: ResourceId): void {
    setHighlightedResourceId(resourceId)
    window.setTimeout(
      () => setHighlightedResourceId(undefined),
      HIGHLIGHT_MS,
    )
  }

  return {
    renderedCollections,
    highlightedResourceId,
    handleDragOver,
    handleDragEnd,
    cancelDrag,
  }
}
