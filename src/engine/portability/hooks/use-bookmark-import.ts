import { useState } from 'react'
import type {
  CollectionId,
  CollectionsState,
} from '@app/features/collections/model/collection.types'
import type {
  BookmarksAdapter,
  BookmarkTreeNode,
} from '@app/platform/browser/bookmarks.adapter'
import { buildBookmarkImportPreview } from '../services/import-bookmark-folder'
import type { ImportPreview } from '../services/import-collection-bundle'

/** The states of the bookmark-folder step that precedes the shared import preview. */
export type BookmarkPickerState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'picking'
      readonly tree: readonly BookmarkTreeNode[]
      readonly selectedFolder?: BookmarkTreeNode
      /** The existing collection to add to; absent means "a new collection". */
      readonly selectedTargetId?: CollectionId
    }
  | { readonly status: 'error'; readonly message: string }

interface UseBookmarkImportOptions {
  readonly adapter: BookmarksAdapter
  readonly state: CollectionsState
  /** Receives the built preview once a folder is confirmed — the shared import flow takes over from there. */
  readonly onPreviewReady: (preview: ImportPreview) => void
}

/**
 * Drives only the bookmark-specific step of a bookmark import: reading the
 * bookmark tree, choosing one folder, and choosing where its bookmarks go —
 * a new collection (the default) or an existing one. Once a folder is
 * confirmed, it builds an `ImportPreview` and hands it to `onPreviewReady`,
 * so everything after that (renaming, conflict checks, confirming, saving)
 * is the same `useImportCollection` flow file import already uses.
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

  /** Chooses the collection to add to while picking; `undefined` means a new collection. */
  function selectTarget(collectionId: CollectionId | undefined): void {
    setPickerState(current =>
      current.status === 'picking'
        ? { ...current, selectedTargetId: collectionId }
        : current,
    )
  }

  /** Builds a preview from the chosen folder and destination, and hands off to the shared import flow. */
  function confirmSelection(): void {
    if (pickerState.status !== 'picking' || !pickerState.selectedFolder) {
      return
    }

    const { selectedFolder, selectedTargetId } = pickerState
    const target =
      selectedTargetId === undefined
        ? undefined
        : state.collections.find(collection => collection.id === selectedTargetId)

    if (selectedTargetId !== undefined && !target) {
      // The chosen collection was deleted while the picker was open. Fall
      // back to "New collection" and stay on the picker, rather than
      // silently creating a new collection the user didn't choose.
      setPickerState({ ...pickerState, selectedTargetId: undefined })
      return
    }

    const preview = buildBookmarkImportPreview(selectedFolder, state, target)

    setPickerState({ status: 'closed' })
    onPreviewReady(preview)
  }

  /** Closes the picker, discarding any selection. */
  function close(): void {
    setPickerState({ status: 'closed' })
  }

  return {
    pickerState,
    open,
    selectFolder,
    selectTarget,
    confirmSelection,
    close,
  }
}
