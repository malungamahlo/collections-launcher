import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ExternalLink,
  GripVertical,
  Globe2,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@app/shared/components/ui/button'
import { cn } from '@app/shared/lib/utils'
import type { WebsiteResource } from '../model/collection.types'
import { getReadableWebsiteDomain } from '../model/website-url'

interface WebsiteResourceItemProps {
  readonly resource: WebsiteResource
  readonly onOpen: (resource: WebsiteResource) => void
  readonly onEdit?: (resource: WebsiteResource) => void
  readonly onDelete?: (resource: WebsiteResource) => void
  readonly isReorderable?: boolean
  readonly isHighlighted?: boolean
}

/**
 * Displays a website's friendly name and readable domain.
 */
export function WebsiteResourceItem({
  resource,
  onOpen,
  onEdit,
  onDelete,
  isReorderable = false,
  isHighlighted = false,
}: WebsiteResourceItemProps) {
  const domain = getReadableWebsiteDomain(resource.url)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: resource.id, disabled: !isReorderable })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'sortable-item flex items-center gap-1.5 rounded-xl transition-colors duration-500',
        isDragging && 'relative z-10 opacity-70',
        isHighlighted && 'bg-accent/15',
      )}
    >
      {isReorderable && (
        <button
          type="button"
          className="grid size-9 shrink-0 touch-none place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Reorder ${resource.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpen(resource)}
        className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-muted/70 px-2.5 py-2.5 text-left transition-all duration-150 hover:bg-slate-300 hover:shadow-[0_8px_20px_rgb(17_26_46_/_0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-3"
        aria-label={`Open ${resource.name}`}
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground"
          aria-hidden="true"
        >
          <Globe2 className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-card-foreground">
            {resource.name}
          </span>

          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {domain}
          </span>
        </span>

        <ExternalLink
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>

      {onEdit && (
        <Button
          variant="secondary"
          className="size-9 shrink-0 px-0 hover:bg-slate-300"
          aria-label={`Edit ${resource.name}`}
          title={`Edit ${resource.name}`}
          onClick={() => onEdit(resource)}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      )}

      {onDelete && (
        <Button
          variant="secondary"
          className="size-9 shrink-0 px-0 text-red-700 hover:bg-red-300"
          aria-label={`Delete ${resource.name}`}
          title={`Delete ${resource.name}`}
          onClick={() => onDelete(resource)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      )}
    </li>
  )
}
