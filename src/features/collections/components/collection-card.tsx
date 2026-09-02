import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  Cloud,
  Code2,
  Download,
  ExternalLink,
  Folder,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'
import { Button } from '@app/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@app/shared/components/ui/card'
import { usePrefersReducedMotion } from '@app/shared/hooks/use-prefers-reduced-motion'
import { cn } from '@app/shared/lib/utils'
import type {
  Collection,
  ResourceId,
  WebsiteResource,
} from '../model/collection.types'
import { emptyCollectionDroppableId } from '../model/resource-drag'
import { WebsiteResourceItem } from './website-resource-item'

interface CollectionCardProps {
  readonly collection: Collection
  readonly onOpenResource: (resource: WebsiteResource) => void
  readonly onOpenAll: (collection: Collection) => void
  readonly onEdit?: (collection: Collection) => void
  readonly onDelete?: (collection: Collection) => void
  readonly onExport?: (collection: Collection) => void
  readonly onAddResource?: (collection: Collection) => void
  readonly onEditResource?: (
    collection: Collection,
    resource: WebsiteResource,
  ) => void
  readonly onDeleteResource?: (
    collection: Collection,
    resource: WebsiteResource,
  ) => void
  /** Whether dragging (reordering or moving resources) is currently enabled. */
  readonly isDragEnabled?: boolean
  /** The resource, if any, to briefly flash after a drag lands. */
  readonly highlightedResourceId?: ResourceId
  /** Whether the card itself can be dragged to reorder collections. */
  readonly isCollectionDragEnabled?: boolean
  /** Whether this card should briefly flash after a collection reorder. */
  readonly isCollectionHighlighted?: boolean
}

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
  onExport,
  onAddResource,
  onEditResource,
  onDeleteResource,
  isDragEnabled = false,
  highlightedResourceId,
  isCollectionDragEnabled = false,
  isCollectionHighlighted = false,
}: CollectionCardProps) {
  const titleId = useId()
  const CollectionIcon = COLLECTION_ICONS[collection.icon ?? ''] ?? Folder
  const resourceCount = collection.resources.length
  const resourceLabel =
    resourceCount === 1 ? '1 resource' : `${resourceCount} resources`
  const { setNodeRef: setEmptyDropZoneRef, isOver: isEmptyDropZoneOver } =
    useDroppable({
      id: emptyCollectionDroppableId(collection.id),
      disabled: !isDragEnabled || collection.resources.length > 0,
    })
  const {
    attributes: cardAttributes,
    listeners: cardListeners,
    setNodeRef: setCardNodeRef,
    transform: cardTransform,
    transition: cardTransition,
    isDragging: isCardDragging,
  } = useSortable({ id: collection.id, disabled: !isCollectionDragEnabled })
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <Card
      ref={setCardNodeRef}
      role="article"
      aria-labelledby={titleId}
      style={{
        transform: CSS.Transform.toString(cardTransform),
        // The sortable reflow transition is essential drag feedback and always
        // plays; only the decorative highlight fade is skipped for reduced motion.
        transition: prefersReducedMotion
          ? cardTransition
          : [cardTransition, 'background-color 500ms ease']
              .filter(Boolean)
              .join(', '),
      }}
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden shadow-[0_12px_30px_rgb(17_26_46_/_0.06)]',
        isCardDragging && 'relative z-10 opacity-70',
        isCollectionHighlighted && 'bg-accent/10',
      )}
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

          {(isCollectionDragEnabled || onEdit || onExport || onDelete) && (
            <div className="flex shrink-0 items-center gap-1">
              {isCollectionDragEnabled && (
                <button
                  type="button"
                  className="grid size-9 shrink-0 touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Reorder ${collection.name}`}
                  {...cardAttributes}
                  {...cardListeners}
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>
              )}

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

              {onExport && (
                <Button
                  variant="secondary"
                  className="size-9 px-0 hover:bg-slate-300"
                  aria-label={`Export ${collection.name}`}
                  title={`Export ${collection.name}`}
                  onClick={() => onExport(collection)}
                >
                  <Download className="size-4" aria-hidden="true" />
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
          <p
            ref={setEmptyDropZoneRef}
            className={cn(
              'rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground transition-colors',
              isEmptyDropZoneOver && 'border-accent bg-accent/5',
            )}
          >
            No websites saved yet.
          </p>
        )}

        {collection.resources.length > 0 && (
          <div className="relative">
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
                    isReorderable={isDragEnabled}
                    isHighlighted={resource.id === highlightedResourceId}
                  />
                ))}
              </ul>
            </SortableContext>

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
