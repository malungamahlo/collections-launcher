import {
  createCollection,
  createFileResource,
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
  ResourceId,
} from '@app/features/collections/model/collection.types'
import { isWebsiteResource } from '@app/features/collections/model/resource.guards'
import { websiteNamesMatch } from '@app/features/collections/model/website-resource.validation'
import type {
  BundleResource,
  CollectionBundle,
  CollectionPackageManifest,
} from '../model/bundle.types'
import {
  filterValidBundleResources,
  filterValidPackageEntries,
} from '../validation/bundle.validation'

/** The existing collection an import adds its resources to, instead of creating a new one. */
export interface ImportTarget {
  readonly id: CollectionId
  readonly name: string
}

/**
 * A file an import will add, with its content in hand. It comes from a
 * package's attachment, already checked against the manifest (size, hash,
 * signature) by the reader.
 */
export interface ImportPreviewFile {
  readonly type: 'file'
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
  /** The file's bytes, stored in the browser when the import is confirmed. */
  readonly content: Blob
}

/**
 * One resource an import will add: a website (`{name, url}`, from any
 * source) or a file (only from a package). Kept as one ordered list so an
 * imported collection has its resources in the order they were exported.
 */
export type ImportPreviewResource = BundleResource | ImportPreviewFile

/** Whether a previewed resource is a file rather than a website. */
export function isImportPreviewFile(
  resource: ImportPreviewResource,
): resource is ImportPreviewFile {
  return 'type' in resource && resource.type === 'file'
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
  readonly resources: readonly ImportPreviewResource[]
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
 * Builds an import preview from a package: its manifest, and the attachments
 * the reader has already verified. The same rules as `buildImportPreview`
 * apply, extended to files — an entry with an invalid name or URL is dropped
 * and counted, and a resource that repeats a name already kept (or, for a
 * website, a URL) is dropped as a duplicate, first occurrence winning. A
 * name is unique across a collection whatever the resource's kind, so a file
 * and a website cannot share one.
 *
 * Each kept file carries its content, taken from `attachments` by the path
 * its manifest entry names. Nothing here writes to state or to storage.
 */
export function buildPackageImportPreview(
  manifest: CollectionPackageManifest,
  attachments: ReadonlyMap<string, Blob>,
  state: CollectionsState,
): ImportPreview {
  const { validEntries, skippedInvalidCount } = filterValidPackageEntries(
    manifest.collection.resources,
  )
  const seenUrls = new Set<string>()
  const seenNames: string[] = []
  const resources: ImportPreviewResource[] = []
  let skippedDuplicateCount = 0

  for (const entry of validEntries) {
    const isDuplicate =
      (entry.type === 'website' && seenUrls.has(entry.url)) ||
      seenNames.some(seenName => websiteNamesMatch(seenName, entry.name))

    if (isDuplicate) {
      skippedDuplicateCount += 1
      continue
    }

    seenNames.push(entry.name)

    if (entry.type === 'website') {
      seenUrls.add(entry.url)
      resources.push({ name: entry.name, url: entry.url })
      continue
    }

    const content = attachments.get(entry.attachment)

    if (!content) {
      // The reader verifies every attachment the manifest names before this
      // is ever called, so this is a programming error, not a bad file.
      throw new Error(`No content was read for attachment "${entry.attachment}".`)
    }

    resources.push({
      type: 'file',
      name: entry.name,
      mimeType: entry.mimeType,
      sizeBytes: entry.sizeBytes,
      content,
    })
  }

  const { collection } = manifest

  return {
    suggestedName: collection.name,
    ...(collection.description ? { description: collection.description } : {}),
    ...(collection.icon ? { icon: collection.icon } : {}),
    ...(collection.color ? { color: collection.color } : {}),
    hasNameConflict: hasCollectionNameConflict(collection.name, state.collections),
    resources,
    skippedDuplicateCount,
    skippedInvalidCount,
  }
}

/** A file's content to store once an import is confirmed, under its new resource's id. */
export interface ImportedFileContent {
  readonly resourceId: ResourceId
  readonly content: Blob
}

/** What confirming an import will write: the new state, and the files to store with it. */
export interface PreparedImport {
  readonly state: CollectionsState
  /** Empty unless the import came from a package with files. */
  readonly fileContents: readonly ImportedFileContent[]
}

/**
 * Works out everything confirming an import will write, without writing any
 * of it: the collections state with the new collection (or the added
 * resources), and — for files — each one's content paired with the id its
 * new resource was given. The caller stores the contents and then saves the
 * state, and removes the contents again if either step fails, so an import
 * is all or nothing. Throws exactly as `applyImportPreview` documents.
 */
export function prepareImport(
  state: CollectionsState,
  preview: ImportPreview,
  chosenName: string,
  dependencies?: FactoryDependencies,
): PreparedImport {
  const fileContents: ImportedFileContent[] = []
  const buildResources = (): CollectionResource[] =>
    preview.resources.map(resource => {
      if (!isImportPreviewFile(resource)) {
        return createWebsiteResource({ name: resource.name, url: resource.url }, dependencies)
      }

      const fileResource = createFileResource(
        {
          name: resource.name,
          mimeType: resource.mimeType,
          sizeBytes: resource.sizeBytes,
        },
        dependencies,
      )
      fileContents.push({ resourceId: fileResource.id, content: resource.content })

      return fileResource
    })

  if (preview.target) {
    const timestamp = (dependencies?.now ?? Date.now)()

    return {
      state: addResourcesToCollection(state, preview.target.id, buildResources(), timestamp),
      fileContents,
    }
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

  return {
    state: addCollection(state, { ...collection, resources: buildResources() }),
    fileContents,
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
  // The state alone — enough for an import with no files. One that has files
  // must go through `prepareImport`, which also says what to store.
  return prepareImport(state, preview, chosenName, dependencies).state
}
