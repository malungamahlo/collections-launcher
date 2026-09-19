import type { CollectionsState } from '@app/features/collections/model/collection.types'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BundleResource } from '../model/bundle.types'
import {
  buildResourcePreview,
  hasCollectionNameConflict,
  type ImportPreview,
} from './import-collection-bundle'

/**
 * Builds an import preview from a chosen bookmark folder: the folder's own
 * name as the suggested collection name, whether that name conflicts with
 * an existing collection, and the resource list produced from the folder's
 * *direct* bookmark children only — subfolders are not recursed into.
 * Shares the exact same per-entry validation and deduplication
 * (`buildResourcePreview`) that file import already uses, so a bookmark
 * with an invalid or duplicate URL is skipped and counted the same way an
 * invalid entry inside an imported file already is. Nothing here writes to
 * state, and nothing here ever writes back to the browser's bookmarks.
 */
export function buildBookmarkImportPreview(
  folder: BookmarkTreeNode,
  state: CollectionsState,
): ImportPreview {
  const rawResources: readonly BundleResource[] = (folder.children ?? [])
    .filter(
      (child): child is BookmarkTreeNode & { url: string } =>
        child.url !== undefined,
    )
    .map(bookmark => ({ name: bookmark.title, url: bookmark.url }))

  const { resources, skippedDuplicateCount, skippedInvalidCount } =
    buildResourcePreview(rawResources)

  return {
    suggestedName: folder.title,
    hasNameConflict: hasCollectionNameConflict(folder.title, state.collections),
    resources,
    skippedDuplicateCount,
    skippedInvalidCount,
  }
}
