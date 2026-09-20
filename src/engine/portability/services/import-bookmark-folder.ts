import type {
  Collection,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BundleResource } from '../model/bundle.types'
import {
  buildResourcePreview,
  hasCollectionNameConflict,
  type ImportPreview,
} from './import-collection-bundle'

/**
 * Builds an import preview from a chosen bookmark folder: the resource list
 * produced from the folder's *direct* bookmark children only — subfolders
 * are not recursed into. Shares the exact same per-entry validation and
 * deduplication (`buildResourcePreview`) that file import already uses, so
 * a bookmark with an invalid or duplicate URL is skipped and counted the
 * same way an invalid entry inside an imported file already is.
 *
 * By default the preview is for a new collection named after the folder,
 * with whether that name conflicts with an existing collection. Pass a
 * `target` collection to import into it instead: the preview then carries
 * the target, uses its name, has no name conflict, and skips any bookmark
 * whose URL or name the target already has (counted as a duplicate).
 *
 * Nothing here writes to state, and nothing here ever writes back to the
 * browser's bookmarks.
 */
export function buildBookmarkImportPreview(
  folder: BookmarkTreeNode,
  state: CollectionsState,
  target?: Collection,
): ImportPreview {
  const rawResources: readonly BundleResource[] = (folder.children ?? [])
    .filter(
      (child): child is BookmarkTreeNode & { url: string } =>
        child.url !== undefined,
    )
    .map(bookmark => ({ name: bookmark.title, url: bookmark.url }))

  const { resources, skippedDuplicateCount, skippedInvalidCount } =
    buildResourcePreview(rawResources, target?.resources)

  if (target) {
    return {
      target: { id: target.id, name: target.name },
      suggestedName: target.name,
      hasNameConflict: false,
      resources,
      skippedDuplicateCount,
      skippedInvalidCount,
    }
  }

  return {
    suggestedName: folder.title,
    hasNameConflict: hasCollectionNameConflict(folder.title, state.collections),
    resources,
    skippedDuplicateCount,
    skippedInvalidCount,
  }
}
