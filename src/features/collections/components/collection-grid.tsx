import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
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
}

const noop = () => undefined

/**
 * Arranges collection cards across responsive dashboard columns and, when
 * dragging is enabled, coordinates reordering and moving resources between
 * cards through a single grid-wide drag context.
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
}: CollectionGridProps) {
  const isDragEnabled = Boolean(onReorderResources) && Boolean(onMoveResource)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const drag = useResourceDrag({
    collections,
    onReorder: onReorderResources ?? noop,
    onMove: onMoveResource ?? noop,
  })

  const renderedCollections = isDragEnabled
    ? drag.renderedCollections
    : collections

  const cards = renderedCollections.map(collection => (
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
      isDragEnabled={isDragEnabled}
      highlightedResourceId={isDragEnabled ? drag.highlightedResourceId : undefined}
    />
  ))

  if (!isDragEnabled) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={event => {
        const overId = event.over?.id
        if (typeof event.active.id === 'string') {
          drag.handleDragOver(
            event.active.id,
            typeof overId === 'string' ? overId : undefined,
          )
        }
      }}
      onDragEnd={event => {
        const overId = event.over?.id
        if (typeof event.active.id === 'string') {
          drag.handleDragEnd(
            event.active.id,
            typeof overId === 'string' ? overId : undefined,
          )
        }
      }}
      onDragCancel={() => drag.cancelDrag()}
    >
      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {renderedCollections.map((collection, index) => (
          <SortableContext
            key={collection.id}
            items={collection.resources.map(resource => resource.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards[index]}
          </SortableContext>
        ))}
      </div>
    </DndContext>
  )
}
