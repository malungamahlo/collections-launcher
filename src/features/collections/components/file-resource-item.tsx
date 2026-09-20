import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink, GripVertical, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { usePrefersReducedMotion } from '@app/shared/hooks/use-prefers-reduced-motion'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import { cn } from '@app/shared/lib/utils'
import type { FileResource } from '../model/collection.types'
import { getResourceKind } from '../model/resource-kind-registry'
import { RESOURCE_ICONS } from './resource-icons'

interface FileResourceItemProps {
  readonly resource: FileResource
  /** When given, the row can be opened; without it the row is display-only. */
  readonly onOpen?: (resource: FileResource) => void
  readonly onDelete?: (resource: FileResource) => void
  readonly isReorderable?: boolean
  readonly isHighlighted?: boolean
}

/**
 * Displays a file resource: a kind-specific icon, its name, and what kind of
 * file it is and how big. One component serves every file type — the registry
 * supplies the icon and label from the resource's MIME type — so supporting a
 * new format never needs a new row component.
 */
export function FileResourceItem({
  resource,
  onOpen,
  onDelete,
  isReorderable = false,
  isHighlighted = false,
}: FileResourceItemProps) {
  const kind = getResourceKind(resource.mimeType)
  const KindIcon = RESOURCE_ICONS[kind.iconKey]
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: resource.id, disabled: !isReorderable })
  const prefersReducedMotion = usePrefersReducedMotion()

  const content: ReactNode = (
    <>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground"
        aria-hidden="true"
      >
        <KindIcon className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-card-foreground">
          {resource.name}
        </span>

        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {kind.label} · {formatFileSize(resource.sizeBytes)}
        </span>
      </span>

      {onOpen && (
        <ExternalLink
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      )}
    </>
  )

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        // The sortable reflow transition is essential drag feedback and always
        // plays; only the decorative highlight fade is skipped for reduced motion.
        transition: prefersReducedMotion
          ? transition
          : [transition, 'background-color 500ms ease']
              .filter(Boolean)
              .join(', '),
      }}
      className={cn(
        'flex items-center gap-1.5 rounded-xl',
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

      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(resource)}
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-muted/70 px-2.5 py-2.5 text-left transition-all duration-150 hover:bg-slate-300 hover:shadow-[0_8px_20px_rgb(17_26_46_/_0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-3"
          aria-label={`Open ${resource.name}`}
        >
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-muted/70 px-2.5 py-2.5 sm:gap-3 sm:px-3">
          {content}
        </div>
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
