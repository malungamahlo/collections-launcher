import { ExternalLink, Globe2 } from 'lucide-react'
import type { WebsiteResource } from '../model/collection.types'
import { getReadableWebsiteDomain } from '../model/website-url'

interface WebsiteResourceItemProps {
  readonly resource: WebsiteResource
  readonly onOpen: (resource: WebsiteResource) => void
}

/**
 * Displays a website's friendly name and readable domain.
 */
export function WebsiteResourceItem({
  resource,
  onOpen,
}: WebsiteResourceItemProps) {
  const domain = getReadableWebsiteDomain(resource.url)

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(resource)}
        className="group flex w-full min-w-0 items-center gap-3 rounded-xl bg-muted/70 px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    </li>
  )
}
