import { Globe2 } from 'lucide-react'
import type { WebsiteResource } from '../model/collection.types'

interface WebsiteResourceItemProps {
  readonly resource: WebsiteResource
}

/**
 * Displays the friendly name of one website resource.
 *
 * Launch behavior will be added through the tabs adapter in C7.
 */
export function WebsiteResourceItem({
  resource,
}: WebsiteResourceItemProps) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-xl bg-muted/70 px-3 py-2.5">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground"
        aria-hidden="true"
      >
        <Globe2 className="size-4" />
      </span>

      <span className="truncate text-sm font-medium text-card-foreground">
        {resource.name}
      </span>
    </li>
  )
}
