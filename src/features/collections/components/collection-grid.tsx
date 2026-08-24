import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useCollectionDrag } from '../hooks/use-collection-drag'
import { useResourceDrag } from '../hooks/use-resource-drag'
import type {
  Collection,
  CollectionId,
  ResourceId,
  WebsiteResource,
} from '../model/collection.types'
import { CollectionCard } from './collection-card'

interface CollectionGridProps {
  readonly collections: readonly Collection[]
  readonly onOpenResource: (resource: WebsiteResource) => void
  readonly onOpenAll: (collection: Collection) => void
  readonly onEditCollection?: (collection: Collection) => void
  readonly onDeleteCollection?: (collection: Collection) => void
  readonly onAddResource?: (collection: Collection) => void
  readonly onEditResource?: (
    collection: Collection,
    resource: WebsiteResource,
  ) => void
  readonly onDeleteResource?: (
    collection: Collection,
    resource: WebsiteResource,
  ) => void
  readonly onReorderResources?: (
    collectionId: CollectionId,
    orderedResourceIds: readonly ResourceId[],
  ) => void
  readonly onMoveResource?: (
    sourceCollectionId: CollectionId,
    targetCollectionId: CollectionId,
    resourceId: ResourceId,
    targetIndex: number,
  ) => void
  readonly onReorderCollections?: (
    orderedCollectionIds: readonly CollectionId[],
  ) => void
}

const noop = () => undefined

/**
 * Arranges collection cards across responsive dashboard columns and, when
 * dragging is enabled, coordinates reordering the cards themselves and
 * reordering or moving resources between cards through a single shared
 * drag context. A dragged item's ID space (a collection vs. a resource)
 * decides which behavior a given drag triggers.
 */
export function CollectionGrid({
  collections,
  onOpenResource,
  onOpenAll,
  onEditCollection,
  onDeleteCollection,
  onAddResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
  onMoveResource,
  onReorderCollections,
}: CollectionGridProps) {
  const isResourceDragEnabled =
    Boolean(onReorderResources) && Boolean(onMoveResource)
  const isCollectionDragEnabled = Boolean(onReorderCollections)
  const isAnyDragEnabled = isResourceDragEnabled || isCollectionDragEnabled

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const resourceDrag = useResourceDrag({
    collections,
    onReorder: onReorderResources ?? noop,
    onMove: onMoveResource ?? noop,
  })
  const collectionDrag = useCollectionDrag({
    collections,
    onReorder: onReorderCollections ?? noop,
  })

  const renderedCollections = isResourceDragEnabled
    ? resourceDrag.renderedCollections
    : collections

  /**
   * Cards and resources share one `DndContext`, so every card and every
   * resource row is a candidate collision target at once. Restrict
   * collision checks to targets of the same kind as the active drag —
   * otherwise a resource drag can report a nearby card as "closest" instead
   * of another resource, and vice versa.
   */
  const collisionDetection: CollisionDetection = args => {
    const collectionIds = new Set(
      collections.map(collection => collection.id),
    )
    const isCollectionDrag = collectionIds.has(String(args.active.id))
    const sameKindContainers = args.droppableContainers.filter(container => {
      const isCollectionContainer = collectionIds.has(String(container.id))
      return isCollectionDrag ? isCollectionContainer : !isCollectionContainer
    })

    return closestCenter({ ...args, droppableContainers: sameKindContainers })
  }

  const renderCard = (collection: Collection) => (
    <CollectionCard
      key={collection.id}
      collection={collection}
      onOpenResource={onOpenResource}
      onOpenAll={onOpenAll}
      onEdit={onEditCollection}
      onDelete={onDeleteCollection}
      onAddResource={onAddResource}
      onEditResource={onEditResource}
      onDeleteResource={onDeleteResource}
      isDragEnabled={isResourceDragEnabled}
      highlightedResourceId={
        isResourceDragEnabled ? resourceDrag.highlightedResourceId : undefined
      }
      isCollectionDragEnabled={isCollectionDragEnabled}
      isCollectionHighlighted={
        collection.id === collectionDrag.highlightedCollectionId
      }
    />
  )

  if (!isAnyDragEnabled) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {renderedCollections.map(renderCard)}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragOver={event => {
        if (typeof event.active.id !== 'string') {
          return
        }

        const activeId = event.active.id
        const overId =
          typeof event.over?.id === 'string' ? event.over.id : undefined
        const isCollectionItem = collections.some(
          collection => collection.id === activeId,
        )

        if (!isCollectionItem) {
          resourceDrag.handleDragOver(activeId, overId)
        }
      }}
      onDragEnd={event => {
        if (typeof event.active.id !== 'string') {
          return
        }

        const activeId = event.active.id
        const overId =
          typeof event.over?.id === 'string' ? event.over.id : undefined
        const isCollectionItem = collections.some(
          collection => collection.id === activeId,
        )

        if (isCollectionItem) {
          collectionDrag.handleDragEnd(activeId, overId)
        } else {
          resourceDrag.handleDragEnd(activeId, overId)
        }
      }}
      onDragCancel={() => resourceDrag.cancelDrag()}
    >
      <SortableContext
        items={renderedCollections.map(collection => collection.id)}
        strategy={rectSortingStrategy}
      >
        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          {renderedCollections.map(renderCard)}
        </div>
      </SortableContext>
    </DndContext>
  )
}
