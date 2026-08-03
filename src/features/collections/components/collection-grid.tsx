import type { Collection, WebsiteResource } from '../model/collection.types'
import { CollectionCard } from './collection-card'

interface CollectionGridProps {
  readonly collections: readonly Collection[]
  readonly onOpenResource: (resource: WebsiteResource) => void
}

/**
 * Arranges collection cards across responsive dashboard columns.
 */
export function CollectionGrid({
  collections,
  onOpenResource,
}: CollectionGridProps) {
  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
      {collections.map(collection => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onOpenResource={onOpenResource}
        />
      ))}
    </div>
  )
}
