import { useState } from 'react'
import type {
  Collection,
  CollectionId,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import type {
  BookmarksAdapter,
  BookmarkTreeNode,
} from '@app/platform/browser/bookmarks.adapter'
import {
  buildBookmarkImportPreview,
  getFolderBookmarks,
  isImportableBookmark,
} from '../services/import-bookmark-folder'
import type { ImportPreview } from '../services/import-collection-bundle'

/**
 * The steps that precede the shared import preview: choose a bookmark
 * folder (`picking`), choose which of its bookmarks to import
 * (`choosing-bookmarks`), then choose where they go
 * (`choosing-destination`).
 */
export type BookmarkPickerState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'picking'
      readonly tree: readonly BookmarkTreeNode[]
      readonly selectedFolder?: BookmarkTreeNode
    }
  | {
      readonly status: 'choosing-bookmarks'
      /** Kept so going back to the folder step doesn't re-read the bookmarks. */
      readonly tree: readonly BookmarkTreeNode[]
      readonly selectedFolder: BookmarkTreeNode
      /** Ids of the folder's bookmarks to import; only importable ones can be in here. */
      readonly selectedBookmarkIds: readonly string[]
    }
  | {
      readonly status: 'choosing-destination'
      readonly tree: readonly BookmarkTreeNode[]
      readonly selectedFolder: BookmarkTreeNode
      readonly selectedBookmarkIds: readonly string[]
      /** The existing collection to add to; absent means "a new collection". */
      readonly selectedTargetId?: CollectionId
    }
  | { readonly status: 'error'; readonly message: string }

/** The ids of a folder's bookmarks that can actually be imported, in folder order. */
function getImportableBookmarkIds(folder: BookmarkTreeNode): string[] {
  return getFolderBookmarks(folder)
    .filter(isImportableBookmark)
    .map(bookmark => bookmark.id)
}

interface UseBookmarkImportOptions {
  readonly adapter: BookmarksAdapter
  readonly state: CollectionsState
  /** Receives the built preview once a folder is confirmed — the shared import flow takes over from there. */
  readonly onPreviewReady: (preview: ImportPreview) => void
}

/**
 * Drives only the bookmark-specific steps of a bookmark import: reading the
 * bookmark tree, choosing one folder, choosing one or more of its bookmarks
 * (all importable ones start selected), then choosing where they go — a new
 * collection (the default) or an existing one. When there are no existing
 * collections there is nothing to choose, so the destination step is
 * skipped. Once the choices are confirmed, it builds an `ImportPreview` and
 * hands it to `onPreviewReady`, so everything after that (renaming,
 * conflict checks, confirming, saving) is the same `useImportCollection`
 * flow file import already uses.
 */
export function useBookmarkImport({
  adapter,
  state,
  onPreviewReady,
}: UseBookmarkImportOptions) {
  const [pickerState, setPickerState] = useState<BookmarkPickerState>({
    status: 'closed',
  })

  /** Reads the bookmark tree fresh each time and opens the folder picker. */
  async function open(): Promise<void> {
    setPickerState({ status: 'loading' })

    try {
      const tree = await adapter.getTree()

      // Ignore the result if the picker was closed while the tree loaded.
      setPickerState(current =>
        current.status === 'loading' ? { status: 'picking', tree } : current,
      )
    } catch (error) {
      console.error('Could not read bookmarks', error)
      setPickerState(current =>
        current.status === 'loading'
          ? {
              status: 'error',
              message: 'Your bookmarks could not be read. Try again.',
            }
          : current,
      )
    }
  }

  /** Marks one folder as the current choice while picking. */
  function selectFolder(folder: BookmarkTreeNode): void {
    setPickerState(current =>
      current.status === 'picking'
        ? { ...current, selectedFolder: folder }
        : current,
    )
  }

  /** Builds a preview for the chosen bookmarks (and optional target) and hands off to the shared import flow. */
  function handOffPreview(
    folder: BookmarkTreeNode,
    selectedBookmarkIds: readonly string[],
    target?: Collection,
  ): void {
    const preview = buildBookmarkImportPreview(
      folder,
      state,
      target,
      selectedBookmarkIds,
    )

    setPickerState({ status: 'closed' })
    onPreviewReady(preview)
  }

  /** Confirms the chosen folder and moves on to choosing its bookmarks, all importable ones pre-selected. */
  function confirmFolder(): void {
    if (pickerState.status !== 'picking' || !pickerState.selectedFolder) {
      return
    }

    const { tree, selectedFolder } = pickerState

    setPickerState({
      status: 'choosing-bookmarks',
      tree,
      selectedFolder,
      selectedBookmarkIds: getImportableBookmarkIds(selectedFolder),
    })
  }

  /** Ticks or unticks one bookmark; a bookmark that can't be imported can never be ticked. */
  function toggleBookmark(bookmarkId: string): void {
    setPickerState(current => {
      if (current.status !== 'choosing-bookmarks') {
        return current
      }

      if (current.selectedBookmarkIds.includes(bookmarkId)) {
        return {
          ...current,
          selectedBookmarkIds: current.selectedBookmarkIds.filter(
            selectedId => selectedId !== bookmarkId,
          ),
        }
      }

      if (!getImportableBookmarkIds(current.selectedFolder).includes(bookmarkId)) {
        return current
      }

      return {
        ...current,
        selectedBookmarkIds: [...current.selectedBookmarkIds, bookmarkId],
      }
    })
  }

  /** Ticks every bookmark in the folder that can be imported. */
  function selectAllBookmarks(): void {
    setPickerState(current =>
      current.status === 'choosing-bookmarks'
        ? {
            ...current,
            selectedBookmarkIds: getImportableBookmarkIds(current.selectedFolder),
          }
        : current,
    )
  }

  /** Unticks every bookmark. */
  function clearBookmarks(): void {
    setPickerState(current =>
      current.status === 'choosing-bookmarks'
        ? { ...current, selectedBookmarkIds: [] }
        : current,
    )
  }

  /**
   * Confirms the chosen bookmarks (at least one) and moves on to choosing
   * their destination. With no existing collections there is nothing to
   * choose — the only option is a new collection — so this goes straight to
   * the preview.
   */
  function confirmBookmarks(): void {
    if (
      pickerState.status !== 'choosing-bookmarks' ||
      pickerState.selectedBookmarkIds.length === 0
    ) {
      return
    }

    const { tree, selectedFolder, selectedBookmarkIds } = pickerState

    if (state.collections.length === 0) {
      handOffPreview(selectedFolder, selectedBookmarkIds)
      return
    }

    setPickerState({
      status: 'choosing-destination',
      tree,
      selectedFolder,
      selectedBookmarkIds,
    })
  }

  /**
   * Steps back exactly one level, keeping the earlier choices: from the
   * destination step to the bookmarks (keeping the selection), and from the
   * bookmarks to the folders (keeping the folder).
   */
  function back(): void {
    setPickerState(current => {
      if (current.status === 'choosing-destination') {
        return {
          status: 'choosing-bookmarks',
          tree: current.tree,
          selectedFolder: current.selectedFolder,
          selectedBookmarkIds: current.selectedBookmarkIds,
        }
      }

      if (current.status === 'choosing-bookmarks') {
        return {
          status: 'picking',
          tree: current.tree,
          selectedFolder: current.selectedFolder,
        }
      }

      return current
    })
  }

  /** Chooses the collection to add to; `undefined` means a new collection. */
  function selectTarget(collectionId: CollectionId | undefined): void {
    setPickerState(current =>
      current.status === 'choosing-destination'
        ? { ...current, selectedTargetId: collectionId }
        : current,
    )
  }

  /** Builds a preview from the chosen folder and destination, and hands off to the shared import flow. */
  function confirmSelection(): void {
    if (pickerState.status !== 'choosing-destination') {
      return
    }

    const { selectedFolder, selectedBookmarkIds, selectedTargetId } = pickerState
    const target =
      selectedTargetId === undefined
        ? undefined
        : state.collections.find(collection => collection.id === selectedTargetId)

    if (selectedTargetId !== undefined && !target) {
      // The chosen collection was deleted while this step was open. Fall
      // back to "New collection" and stay here, rather than silently
      // creating a new collection the user didn't choose.
      setPickerState({ ...pickerState, selectedTargetId: undefined })
      return
    }

    handOffPreview(selectedFolder, selectedBookmarkIds, target)
  }

  /** Closes the picker, discarding any selection. */
  function close(): void {
    setPickerState({ status: 'closed' })
  }

  return {
    pickerState,
    open,
    selectFolder,
    confirmFolder,
    toggleBookmark,
    selectAllBookmarks,
    clearBookmarks,
    confirmBookmarks,
    back,
    selectTarget,
    confirmSelection,
    close,
  }
}
