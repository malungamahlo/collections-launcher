import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AppWindow, Download, Ellipsis, Globe, GripVertical, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Menu, type MenuItem } from '@app/shared/components/ui/menu'
import { usePrefersReducedMotion } from '@app/shared/hooks/use-prefers-reduced-motion'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import { cn } from '@app/shared/lib/utils'
import type { FileResource } from '../model/collection.types'
import { getOpenOptions, getResourceKind } from '../model/resource-kind-registry'
import { RESOURCE_ICONS } from './resource-icons'

interface FileResourceItemProps {
  readonly resource: FileResource
  /**
   * When given, the row can be opened — the default way: in the browser when it
   * can be shown there, else in its application. Without it the row is display-only.
   */
  readonly onOpen?: (resource: FileResource) => void
  /** When given, an Office file's menu offers to open it in its desktop application. */
  readonly onOpenInApp?: (resource: FileResource) => void
  /** When given, the menu offers to save a copy of the file. */
  readonly onSave?: (resource: FileResource) => void
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
  onOpenInApp,
  onSave,
  onDelete,
  isReorderable = false,
  isHighlighted = false,
}: FileResourceItemProps) {
  const kind = getResourceKind(resource.mimeType)
  const openOptions = getOpenOptions(resource.mimeType)
  // The "Open with…" choices: every way this file can be opened, then a copy to keep.
  const menuItems: MenuItem[] = [
    ...(onOpen && openOptions.inBrowser
      ? [{ label: 'Open in browser', icon: <Globe className="size-4" />, onSelect: () => onOpen(resource) }]
      : []),
    ...(onOpenInApp && openOptions.appName
      ? [
          {
            label: `Open in ${openOptions.appName}`,
            icon: <AppWindow className="size-4" />,
            onSelect: () => onOpenInApp(resource),
          },
        ]
      : []),
    ...(onSave
      ? [{ label: 'Save a copy', icon: <Download className="size-4" />, onSelect: () => onSave(resource) }]
      : []),
  ]
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

        {/* Wraps rather than truncates: the row also carries a save and a delete
            button, and the kind and size are worth more than a tidy single line.
            Non-breaking spaces keep "8.4 KB" (and the dot before it) in one piece
            when it does wrap. */}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {`${kind.label}\u00A0· ${formatFileSize(resource.sizeBytes).replace(' ', '\u00A0')}`}
        </span>
      </span>
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

      {menuItems.length > 0 && (
        <Menu
          label={`More options for ${resource.name}`}
          items={menuItems}
          triggerClassName="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-card-foreground transition-colors hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Menu>
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
