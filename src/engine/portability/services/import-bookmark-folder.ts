import type {
  Collection,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import type { BundleResource } from '../model/bundle.types'
import { filterValidBundleResources } from '../validation/bundle.validation'
import {
  buildResourcePreview,
  hasCollectionNameConflict,
  type ImportPreview,
} from './import-collection-bundle'

/** A bookmark node (as opposed to a folder): it always has a URL. */
export type FolderBookmark = BookmarkTreeNode & { readonly url: string }

/**
 * The bookmarks directly inside a folder — subfolders are never included,
 * and bookmarks nested inside them are not recursed into. The one
 * definition of "the folder's bookmarks", shared by the list a user picks
 * from and the preview built from their picks.
 */
export function getFolderBookmarks(
  folder: BookmarkTreeNode,
): readonly FolderBookmark[] {
  return (folder.children ?? []).filter(
    (child): child is FolderBookmark => child.url !== undefined,
  )
}

/**
 * Whether a bookmark would survive import validation — an internal
 * `chrome://` page, a `javascript:` URL, or an untitled bookmark would not.
 * Runs the bookmark through the same `filterValidBundleResources` that
 * previews use, so "importable" has exactly one definition rather than a
 * second copy of the rules that could drift.
 */
export function isImportableBookmark(bookmark: FolderBookmark): boolean {
  return (
    filterValidBundleResources([{ name: bookmark.title, url: bookmark.url }])
      .validResources.length === 1
  )
}

/**
 * Builds an import preview from a chosen bookmark folder: the resource list
 * produced from the folder's *direct* bookmark children only — subfolders
 * are not recursed into. Shares the exact same per-entry validation and
 * deduplication (`buildResourcePreview`) that file import already uses, so
 * a bookmark with an invalid or duplicate URL is skipped and counted the
 * same way an invalid entry inside an imported file already is.
 *
 * By default every bookmark in the folder is included. Pass
 * `selectedBookmarkIds` to include only those the user picked.
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
  selectedBookmarkIds?: readonly string[],
): ImportPreview {
  const selectedIds =
    selectedBookmarkIds === undefined ? undefined : new Set(selectedBookmarkIds)
  const rawResources: readonly BundleResource[] = getFolderBookmarks(folder)
    .filter(bookmark => selectedIds === undefined || selectedIds.has(bookmark.id))
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
