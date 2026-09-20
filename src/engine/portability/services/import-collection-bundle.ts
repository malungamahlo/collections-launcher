import {
  createCollection,
  createWebsiteResource,
  type FactoryDependencies,
} from '@app/features/collections/model/collection.factory'
import { collectionNamesMatch } from '@app/features/collections/model/collection.validation'
import {
  addCollection,
  addResourcesToCollection,
} from '@app/features/collections/model/collection.operations'
import type {
  Collection,
  CollectionId,
  CollectionResource,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import { isWebsiteResource } from '@app/features/collections/model/resource.guards'
import { websiteNamesMatch } from '@app/features/collections/model/website-resource.validation'
import type { BundleResource, CollectionBundle } from '../model/bundle.types'
import { filterValidBundleResources } from '../validation/bundle.validation'

/** The existing collection an import adds its resources to, instead of creating a new one. */
export interface ImportTarget {
  readonly id: CollectionId
  readonly name: string
}

/** The outcome of previewing an import before anything is written to state. */
export interface ImportPreview {
  /**
   * When set, the import adds `resources` to this existing collection
   * instead of creating a new one, and `suggestedName` is just its name.
   */
  readonly target?: ImportTarget
  readonly suggestedName: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
  readonly hasNameConflict: boolean
  readonly resources: readonly BundleResource[]
  readonly skippedDuplicateCount: number
  readonly skippedInvalidCount: number
}

/**
 * Returns whether an existing collection's name conflicts with the given
 * name, using the same rule `addCollection`/`updateCollection` enforce
 * (case-insensitive, trimmed). Exported so the import dialog can re-check
 * a name the user has edited before it ever reaches the domain layer.
 */
export function hasCollectionNameConflict(
  name: string,
  collections: readonly Collection[],
): boolean {
  return collections.some(collection =>
    collectionNamesMatch(collection.name, name),
  )
}

/** The resource-list portion of an `ImportPreview`, shared across every import source. */
export interface ResourcePreview {
  readonly resources: readonly BundleResource[]
  readonly skippedDuplicateCount: number
  readonly skippedInvalidCount: number
}

/**
 * Filters and deduplicates a raw `{name, url}` resource list — the part of
 * building a preview that has nothing to do with *where* the list came
 * from. Used by every import source (a parsed bundle file, a bookmark
 * folder, and whatever comes next): each maps its own raw shape into
 * `BundleResource[]` first, then shares this one implementation for
 * per-entry validation and same-URL/same-name deduplication, rather than
 * each source reimplementing it.
 *
 * When importing into an existing collection, pass that collection's
 * resources as `existingResources`: they seed the seen URLs and names, so an
 * incoming resource the collection already has is skipped and counted as a
 * duplicate (the existing one wins, matching "first occurrence wins").
 */
export function buildResourcePreview(
  rawResources: readonly BundleResource[],
  existingResources: readonly CollectionResource[] = [],
): ResourcePreview {
  const { validResources, skippedInvalidCount } =
    filterValidBundleResources(rawResources)

  // Only websites have a URL to collide on; every resource has a name.
  const seenUrls = new Set<string>(
    existingResources.filter(isWebsiteResource).map(resource => resource.url),
  )
  const seenNames: string[] = existingResources.map(resource => resource.name)
  const resources: BundleResource[] = []
  let skippedDuplicateCount = 0

  for (const resource of validResources) {
    const isDuplicate =
      seenUrls.has(resource.url) ||
      seenNames.some(seenName => websiteNamesMatch(seenName, resource.name))

    if (isDuplicate) {
      skippedDuplicateCount += 1
      continue
    }

    seenUrls.add(resource.url)
    seenNames.push(resource.name)
    resources.push(resource)
  }

  return { resources, skippedDuplicateCount, skippedInvalidCount }
}

/**
 * Builds an import preview from a structurally valid bundle: the suggested
 * name and description, whether that name conflicts with an existing
 * collection, and the resource list that would actually be imported after
 * dropping invalid entries and deduplicating resources that repeat a URL
 * or a name within the file itself. Nothing here writes to state.
 */
export function buildImportPreview(
  bundle: CollectionBundle,
  state: CollectionsState,
): ImportPreview {
  const { resources, skippedDuplicateCount, skippedInvalidCount } =
    buildResourcePreview(bundle.collection.resources)

  return {
    suggestedName: bundle.collection.name,
    ...(bundle.collection.description
      ? { description: bundle.collection.description }
      : {}),
    ...(bundle.collection.icon ? { icon: bundle.collection.icon } : {}),
    ...(bundle.collection.color ? { color: bundle.collection.color } : {}),
    hasNameConflict: hasCollectionNameConflict(
      bundle.collection.name,
      state.collections,
    ),
    resources,
    skippedDuplicateCount,
    skippedInvalidCount,
  }
}

/**
 * Commits an import preview: either as one brand-new collection, named by
 * the caller (which may differ from the preview's suggested name if the
 * user renamed it before confirming), or — when the preview has a `target`
 * — by adding its resources to that existing collection, in which case
 * `chosenName` is ignored. Builds every resource through the existing
 * factories, then writes them with a single `addCollection` /
 * `addResourcesToCollection` call. Nothing before that call touches
 * `state`, so if it throws `CollectionOperationError` — for a new
 * collection, most plausibly `DUPLICATE_COLLECTION_NAME` if another
 * collection was given this exact name after the preview was built; for a
 * target, `COLLECTION_NOT_FOUND` if it was deleted, or a duplicate resource
 * name/URL if one was added since; or an id collision, astronomically
 * unlikely with generated ids but structurally possible — no partial state
 * is ever produced; the caller should only call `save()` after this
 * returns successfully. Callers should still pre-check
 * `hasCollectionNameConflict` before creating a new collection, so the
 * common case is caught with a friendly message instead of a thrown error.
 */
export function applyImportPreview(
  state: CollectionsState,
  preview: ImportPreview,
  chosenName: string,
  dependencies?: FactoryDependencies,
): CollectionsState {
  const buildResources = () =>
    preview.resources.map(resource =>
      createWebsiteResource(
        { name: resource.name, url: resource.url },
        dependencies,
      ),
    )

  if (preview.target) {
    const timestamp = (dependencies?.now ?? Date.now)()

    return addResourcesToCollection(
      state,
      preview.target.id,
      buildResources(),
      timestamp,
    )
  }

  const collection = createCollection(
    {
      name: chosenName,
      description: preview.description,
      icon: preview.icon,
      color: preview.color,
    },
    dependencies,
  )

  return addCollection(state, { ...collection, resources: buildResources() })
}
