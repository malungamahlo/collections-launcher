import { Cloud, Code2, Folder, Search, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
} from '@app/shared/components/ui/card'
import type { Collection } from '../model/collection.types'
import { WebsiteResourceItem } from './website-resource-item'

interface CollectionCardProps {
  readonly collection: Collection
}

const COLLECTION_ICONS: Readonly<Record<string, LucideIcon>> = {
  cloud: Cloud,
  code: Code2,
  search: Search,
}

/**
 * Displays one collection and its website resources.
 */
export function CollectionCard({ collection }: CollectionCardProps) {
  const titleId = useId()
  const CollectionIcon = COLLECTION_ICONS[collection.icon ?? ''] ?? Folder
  const resourceCount = collection.resources.length
  const resourceLabel =
    resourceCount === 1 ? '1 resource' : `${resourceCount} resources`

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      className="h-full overflow-hidden shadow-[0_12px_30px_rgb(17_26_46_/_0.06)]"
    >
      <div
        className="h-1.5"
        style={{ backgroundColor: collection.color ?? '#64748b' }}
        aria-hidden="true"
      />

      <CardHeader>
        <div className="flex items-start gap-3">
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
              className="truncate text-lg font-semibold text-card-foreground"
            >
              {collection.name}
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
              {resourceLabel}
            </p>
          </div>
        </div>

        {collection.description && (
          <p className="pt-2 text-sm leading-6 text-muted-foreground">
            {collection.description}
          </p>
        )}
      </CardHeader>

      <CardContent>
        <ul className="space-y-2">
          {collection.resources.map(resource => (
            <WebsiteResourceItem key={resource.id} resource={resource} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
