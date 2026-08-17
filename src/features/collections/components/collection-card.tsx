import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ChevronDown,
  Cloud,
  Code2,
  ExternalLink,
  Folder,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@app/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@app/shared/components/ui/card'
import type {
  Collection,
  ResourceId,
  WebsiteResource,
} from '../model/collection.types'
import { WebsiteResourceItem } from './website-resource-item'

interface CollectionCardProps {
  readonly collection: Collection
  readonly onOpenResource: (resource: WebsiteResource) => void
  readonly onOpenAll: (collection: Collection) => void
  readonly onEdit?: (collection: Collection) => void
  readonly onDelete?: (collection: Collection) => void
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
    collection: Collection,
    orderedResourceIds: readonly ResourceId[],
  ) => void
}

/** How long a just-reordered row stays highlighted. */
const REORDER_HIGHLIGHT_MS = 900

const COLLECTION_ICONS: Readonly<Record<string, LucideIcon>> = {
  cloud: Cloud,
  code: Code2,
  search: Search,
}

/** Approximate number of resource rows that fit before the list scrolls internally. */
const VISIBLE_RESOURCE_ROWS = 5

/**
 * Displays one collection and its website resources.
 */
export function CollectionCard({
  collection,
  onOpenResource,
  onOpenAll,
  onEdit,
  onDelete,
  onAddResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
}: CollectionCardProps) {
  const titleId = useId()
  const CollectionIcon = COLLECTION_ICONS[collection.icon ?? ''] ?? Folder
  const resourceCount = collection.resources.length
  const resourceLabel =
    resourceCount === 1 ? '1 resource' : `${resourceCount} resources`
  const isReorderable = Boolean(onReorderResources)
  const [highlightedResourceId, setHighlightedResourceId] =
    useState<ResourceId>()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  /** Persists a completed drag as the new resource order and flashes the moved row. */
  function handleResourceDragEnd(event: DragEndEvent): void {
    const { active, over } = event

    if (
      !onReorderResources ||
      !over ||
      active.id === over.id ||
      typeof active.id !== 'string' ||
      typeof over.id !== 'string'
    ) {
      return
    }

    const resourceIds = collection.resources.map(resource => resource.id)
    const oldIndex = resourceIds.indexOf(active.id)
    const newIndex = resourceIds.indexOf(over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    onReorderResources(collection, arrayMove(resourceIds, oldIndex, newIndex))
    setHighlightedResourceId(active.id)
    window.setTimeout(
      () => setHighlightedResourceId(undefined),
      REORDER_HIGHLIGHT_MS,
    )
  }

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      className="flex h-full min-w-0 flex-col overflow-hidden shadow-[0_12px_30px_rgb(17_26_46_/_0.06)]"
    >
      <div
        className="h-1.5"
        style={{ backgroundColor: collection.color ?? '#64748b' }}
        aria-hidden="true"
      />

      <CardHeader className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl text-white"
              style={{ backgroundColor: collection.color ?? '#64748b' }}
              aria-hidden="true"
            >
              <CollectionIcon className="size-5" />
            </span>

            <div className="min-w-0">
              <h3
                id={titleId}
                className="break-words text-lg leading-6 font-semibold text-card-foreground"
              >
                {collection.name}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {resourceLabel}
              </p>
            </div>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex shrink-0 items-center gap-1">
              {onEdit && (
                <Button
                  variant="secondary"
                  className="size-9 px-0 hover:bg-slate-300"
                  aria-label={`Edit ${collection.name}`}
                  title={`Edit ${collection.name}`}
                  onClick={() => onEdit(collection)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="secondary"
                  className="size-9 px-0 text-red-700 hover:bg-red-300"
                  aria-label={`Delete ${collection.name}`}
                  title={`Delete ${collection.name}`}
                  onClick={() => onDelete(collection)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>

        {collection.description && (
          <p className="break-words pt-2 text-sm leading-6 text-muted-foreground">
            {collection.description}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-3 sm:flex-row">
          <Button
            variant="secondary"
            className="flex-1 gap-2 hover:bg-slate-300"
            disabled={collection.resources.length === 0}
            onClick={() => onOpenAll(collection)}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Open all
          </Button>

          {onAddResource && (
            <Button
              variant="secondary"
              className="flex-1 gap-2 hover:bg-slate-300"
              onClick={() => onAddResource(collection)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add website
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-4 pb-4 sm:px-5 sm:pb-5">
        {collection.resources.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
            No websites saved yet.
          </p>
        )}

        {collection.resources.length > 0 && (
          <div className="relative">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleResourceDragEnd}
            >
              <SortableContext
                items={collection.resources.map(resource => resource.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="scroll-slim max-h-80 space-y-2 overflow-y-auto pr-1">
                  {collection.resources.map(resource => (
                    <WebsiteResourceItem
                      key={resource.id}
                      resource={resource}
                      onOpen={onOpenResource}
                      onEdit={
                        onEditResource
                          ? currentResource =>
                              onEditResource(collection, currentResource)
                          : undefined
                      }
                      onDelete={
                        onDeleteResource
                          ? currentResource =>
                              onDeleteResource(collection, currentResource)
                          : undefined
                      }
                      isReorderable={isReorderable}
                      isHighlighted={resource.id === highlightedResourceId}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {collection.resources.length > VISIBLE_RESOURCE_ROWS && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 flex h-9 items-end justify-center bg-gradient-to-t from-card to-transparent"
              >
                <ChevronDown className="mb-0.5 size-4 text-muted-foreground motion-safe:animate-bounce" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
