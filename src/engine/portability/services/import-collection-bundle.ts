import {
  createCollection,
  createWebsiteResource,
  type FactoryDependencies,
} from '@app/features/collections/model/collection.factory'
import { collectionNamesMatch } from '@app/features/collections/model/collection.validation'
import { addCollection } from '@app/features/collections/model/collection.operations'
import type {
  Collection,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import { websiteNamesMatch } from '@app/features/collections/model/website-resource.validation'
import type { BundleResource, CollectionBundle } from '../model/bundle.types'
import { filterValidBundleResources } from '../validation/bundle.validation'

/** The outcome of previewing an import before anything is written to state. */
export interface ImportPreview {
  readonly suggestedName: string
  readonly description?: string
  readonly icon?: string
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
  const { validResources, skippedInvalidCount } = filterValidBundleResources(
    bundle.collection.resources,
  )

  const seenUrls = new Set<string>()
  const seenNames: string[] = []
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

  return {
    suggestedName: bundle.collection.name,
    ...(bundle.collection.description
      ? { description: bundle.collection.description }
      : {}),
    ...(bundle.collection.icon ? { icon: bundle.collection.icon } : {}),
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
 * Commits an import preview as one brand-new collection, named by the
 * caller (which may differ from the preview's suggested name if the user
 * renamed it before confirming). Builds the collection and every resource
 * through the existing factories, then writes them with a single
 * `addCollection` call. Nothing before that call touches `state`, so if
 * `addCollection` throws `CollectionOperationError` — most plausibly
 * `DUPLICATE_COLLECTION_NAME` if another collection was given this exact
 * name after the preview was built, or an id collision, astronomically
 * unlikely with generated ids but structurally possible — no partial state
 * is ever produced; the caller should only call `save()` after this
 * returns successfully. Callers should still pre-check
 * `hasCollectionNameConflict` before calling this, so the common case is
 * caught with a friendly message instead of a thrown error.
 */
export function applyImportPreview(
  state: CollectionsState,
  preview: ImportPreview,
  chosenName: string,
  dependencies?: FactoryDependencies,
): CollectionsState {
  const collection = createCollection(
    { name: chosenName, description: preview.description, icon: preview.icon },
    dependencies,
  )
  const resources = preview.resources.map(resource =>
    createWebsiteResource(
      { name: resource.name, url: resource.url },
      dependencies,
    ),
  )

  return addCollection(state, { ...collection, resources })
}
