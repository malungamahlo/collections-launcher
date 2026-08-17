import type {
  Collection,
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
    collection: Collection,
    orderedResourceIds: readonly ResourceId[],
  ) => void
}

/**
 * Arranges collection cards across responsive dashboard columns.
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
}: CollectionGridProps) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
      {collections.map(collection => (
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
          onReorderResources={onReorderResources}
        />
      ))}
    </div>
  )
}
