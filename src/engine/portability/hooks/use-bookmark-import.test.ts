// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import type {
  BookmarksAdapter,
  BookmarkTreeNode,
} from '@app/platform/browser/bookmarks.adapter'
import { useBookmarkImport } from './use-bookmark-import'

afterEach(() => {
  cleanup()
})

const workFolder: BookmarkTreeNode = {
  id: 'work',
  title: 'Work',
  children: [
    { id: '1', title: 'GitHub', url: 'https://github.com/' },
    { id: '2', title: 'Extensions', url: 'chrome://extensions/' },
  ],
}

const tree: readonly BookmarkTreeNode[] = [
  { id: 'bar', title: 'Bookmarks bar', children: [workFolder] },
]

function createAdapter(
  getTree: BookmarksAdapter['getTree'],
): BookmarksAdapter {
  return { getTree }
}

describe('useBookmarkImport', () => {
  it('starts closed', () => {
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
        state: createTestState(),
        onPreviewReady: vi.fn(),
      }),
    )

    expect(result.current.pickerState).toEqual({ status: 'closed' })
  })

  it('shows loading while the tree is read, then the picker', async () => {
    let resolveTree: (nodes: readonly BookmarkTreeNode[]) => void = () => undefined
    const adapter = createAdapter(
      () => new Promise(resolve => (resolveTree = resolve)),
    )
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter,
        state: createTestState(),
        onPreviewReady: vi.fn(),
      }),
    )

    let opening: Promise<void> = Promise.resolve()
    act(() => {
      opening = result.current.open()
    })

    expect(result.current.pickerState).toEqual({ status: 'loading' })

    await act(async () => {
      resolveTree(tree)
      await opening
    })

    expect(result.current.pickerState).toEqual({ status: 'picking', tree })
  })

  it('reports an error without throwing when the bookmarks cannot be read', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter: createAdapter(vi.fn().mockRejectedValue(new Error('denied'))),
        state: createTestState(),
        onPreviewReady: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.open()
    })

    expect(result.current.pickerState).toEqual({
      status: 'error',
      message: 'Your bookmarks could not be read. Try again.',
    })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('discards a tree that finishes loading after the picker was closed', async () => {
    let resolveTree: (nodes: readonly BookmarkTreeNode[]) => void = () => undefined
    const adapter = createAdapter(
      () => new Promise(resolve => (resolveTree = resolve)),
    )
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter,
        state: createTestState(),
        onPreviewReady: vi.fn(),
      }),
    )

    let opening: Promise<void> = Promise.resolve()
    act(() => {
      opening = result.current.open()
    })
    act(() => {
      result.current.close()
    })
    await act(async () => {
      resolveTree(tree)
      await opening
    })

    expect(result.current.pickerState).toEqual({ status: 'closed' })
  })

  it('records the selected folder while picking', async () => {
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
        state: createTestState(),
        onPreviewReady: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.open()
    })
    act(() => {
      result.current.selectFolder(workFolder)
    })

    expect(result.current.pickerState).toEqual({
      status: 'picking',
      tree,
      selectedFolder: workFolder,
    })
  })

  const reference = createTestCollection({
    id: 'reference',
    name: 'Reference',
    resources: [
      createTestWebsiteResource({
        name: 'GitHub',
        url: 'https://github.com/',
      }),
    ],
  })

  // A folder with three importable bookmarks and one internal page.
  const linksFolder: BookmarkTreeNode = {
    id: 'links',
    title: 'Links',
    children: [
      { id: 'a', title: 'GitHub', url: 'https://github.com/' },
      { id: 'b', title: 'MDN', url: 'https://developer.mozilla.org/' },
      { id: 'c', title: 'Vitest', url: 'https://vitest.dev/' },
      { id: 'd', title: 'Extensions', url: 'chrome://extensions/' },
    ],
  }
  const linksTree: readonly BookmarkTreeNode[] = [
    { id: 'bar', title: 'Bookmarks bar', children: [linksFolder] },
  ]

  async function openAndSelectFolder(
    state: CollectionsState,
    onPreviewReady = vi.fn(),
    folder: BookmarkTreeNode = workFolder,
    folderTree: readonly BookmarkTreeNode[] = tree,
  ) {
    const rendered = renderHook(() =>
      useBookmarkImport({
        adapter: createAdapter(vi.fn().mockResolvedValue(folderTree)),
        state,
        onPreviewReady,
      }),
    )

    await act(async () => {
      await rendered.result.current.open()
    })
    act(() => {
      rendered.result.current.selectFolder(folder)
    })

    return { ...rendered, onPreviewReady }
  }

  async function openAndConfirmFolder(
    state: CollectionsState,
    onPreviewReady = vi.fn(),
    folder: BookmarkTreeNode = workFolder,
    folderTree: readonly BookmarkTreeNode[] = tree,
  ) {
    const rendered = await openAndSelectFolder(
      state,
      onPreviewReady,
      folder,
      folderTree,
    )

    act(() => {
      rendered.result.current.confirmFolder()
    })

    return rendered
  }

  async function openAndConfirmBookmarks(
    state: CollectionsState,
    onPreviewReady = vi.fn(),
    folder: BookmarkTreeNode = workFolder,
    folderTree: readonly BookmarkTreeNode[] = tree,
  ) {
    const rendered = await openAndConfirmFolder(
      state,
      onPreviewReady,
      folder,
      folderTree,
    )

    act(() => {
      rendered.result.current.confirmBookmarks()
    })

    return rendered
  }

  describe('choosing bookmarks', () => {
    it('moves to choosing bookmarks once a folder is confirmed, with every importable bookmark selected', async () => {
      const { result, onPreviewReady } = await openAndConfirmFolder(
        createTestState({ collections: [reference] }),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      expect(result.current.pickerState).toEqual({
        status: 'choosing-bookmarks',
        tree: linksTree,
        selectedFolder: linksFolder,
        selectedBookmarkIds: ['a', 'b', 'c'],
      })
      expect(onPreviewReady).not.toHaveBeenCalled()
    })

    it('does not move on until a folder is selected', async () => {
      const { result } = renderHook(() =>
        useBookmarkImport({
          adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
          state: createTestState({ collections: [reference] }),
          onPreviewReady: vi.fn(),
        }),
      )

      await act(async () => {
        await result.current.open()
      })
      act(() => {
        result.current.confirmFolder()
      })

      expect(result.current.pickerState.status).toBe('picking')
    })

    it('unticks a bookmark and ticks it again', async () => {
      const { result } = await openAndConfirmFolder(
        createTestState(),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.toggleBookmark('b')
      })

      expect(result.current.pickerState).toMatchObject({
        selectedBookmarkIds: ['a', 'c'],
      })

      act(() => {
        result.current.toggleBookmark('b')
      })

      expect(result.current.pickerState).toMatchObject({
        selectedBookmarkIds: ['a', 'c', 'b'],
      })
    })

    it('refuses to tick a bookmark that cannot be imported', async () => {
      const { result } = await openAndConfirmFolder(
        createTestState(),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.toggleBookmark('d')
      })

      expect(result.current.pickerState).toMatchObject({
        selectedBookmarkIds: ['a', 'b', 'c'],
      })
    })

    it('clears the selection, and selects every importable bookmark again', async () => {
      const { result } = await openAndConfirmFolder(
        createTestState(),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.clearBookmarks()
      })

      expect(result.current.pickerState).toMatchObject({
        selectedBookmarkIds: [],
      })

      act(() => {
        result.current.selectAllBookmarks()
      })

      expect(result.current.pickerState).toMatchObject({
        selectedBookmarkIds: ['a', 'b', 'c'],
      })
    })

    it('does not move on while nothing is selected', async () => {
      const { result, onPreviewReady } = await openAndConfirmFolder(
        createTestState({ collections: [reference] }),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.clearBookmarks()
      })
      act(() => {
        result.current.confirmBookmarks()
      })

      expect(result.current.pickerState.status).toBe('choosing-bookmarks')
      expect(onPreviewReady).not.toHaveBeenCalled()
    })

    it('with no existing collections, skips the destination step and previews only the selected bookmarks as a new collection', async () => {
      const { result, onPreviewReady } = await openAndConfirmFolder(
        createTestState(),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.toggleBookmark('a')
      })
      act(() => {
        result.current.confirmBookmarks()
      })

      expect(onPreviewReady).toHaveBeenCalledOnce()
      expect(onPreviewReady.mock.calls[0]?.[0]).toMatchObject({
        suggestedName: 'Links',
        resources: [
          { name: 'MDN', url: 'https://developer.mozilla.org/' },
          { name: 'Vitest', url: 'https://vitest.dev/' },
        ],
        skippedInvalidCount: 0,
      })
      expect(onPreviewReady.mock.calls[0]?.[0]).not.toHaveProperty('target')
      expect(result.current.pickerState).toEqual({ status: 'closed' })
    })

    it('with existing collections, moves to choosing a destination keeping the selection', async () => {
      const { result, onPreviewReady } = await openAndConfirmFolder(
        createTestState({ collections: [reference] }),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.toggleBookmark('c')
      })
      act(() => {
        result.current.confirmBookmarks()
      })

      expect(result.current.pickerState).toEqual({
        status: 'choosing-destination',
        tree: linksTree,
        selectedFolder: linksFolder,
        selectedBookmarkIds: ['a', 'b'],
      })
      expect(onPreviewReady).not.toHaveBeenCalled()
    })

    it('goes back to the folder step keeping the chosen folder', async () => {
      const { result } = await openAndConfirmFolder(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.back()
      })

      expect(result.current.pickerState).toEqual({
        status: 'picking',
        tree,
        selectedFolder: workFolder,
      })
    })

    it('starts a different folder with its own fresh selection', async () => {
      const differentFolderTree: readonly BookmarkTreeNode[] = [
        { id: 'bar', title: 'Bookmarks bar', children: [workFolder, linksFolder] },
      ]
      const { result } = await openAndConfirmFolder(
        createTestState(),
        vi.fn(),
        workFolder,
        differentFolderTree,
      )

      act(() => {
        result.current.back()
      })
      act(() => {
        result.current.selectFolder(linksFolder)
      })
      act(() => {
        result.current.confirmFolder()
      })

      expect(result.current.pickerState).toMatchObject({
        status: 'choosing-bookmarks',
        selectedFolder: linksFolder,
        selectedBookmarkIds: ['a', 'b', 'c'],
      })
    })

    it('ignores bookmark choices made outside the bookmarks step', async () => {
      const { result } = await openAndSelectFolder(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.toggleBookmark('1')
      })
      act(() => {
        result.current.clearBookmarks()
      })
      act(() => {
        result.current.selectAllBookmarks()
      })

      expect(result.current.pickerState).toEqual({
        status: 'picking',
        tree,
        selectedFolder: workFolder,
      })
    })
  })

  describe('choosing a destination collection', () => {
    it('goes back to the bookmarks step keeping the selection', async () => {
      const { result } = await openAndConfirmFolder(
        createTestState({ collections: [reference] }),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.toggleBookmark('a')
      })
      act(() => {
        result.current.confirmBookmarks()
      })
      act(() => {
        result.current.back()
      })

      expect(result.current.pickerState).toEqual({
        status: 'choosing-bookmarks',
        tree: linksTree,
        selectedFolder: linksFolder,
        selectedBookmarkIds: ['b', 'c'],
      })
    })

    it('records the selected target, and clears it again', async () => {
      const { result } = await openAndConfirmBookmarks(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.selectTarget('reference')
      })

      expect(result.current.pickerState).toMatchObject({
        status: 'choosing-destination',
        selectedTargetId: 'reference',
      })

      act(() => {
        result.current.selectTarget(undefined)
      })

      expect(result.current.pickerState).toMatchObject({
        status: 'choosing-destination',
        selectedTargetId: undefined,
      })
    })

    it('ignores a target choice made outside the destination step', async () => {
      const { result } = await openAndSelectFolder(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.selectTarget('reference')
      })

      expect(result.current.pickerState).toEqual({
        status: 'picking',
        tree,
        selectedFolder: workFolder,
      })
    })

    it('imports as a new collection by default', async () => {
      const { result, onPreviewReady } = await openAndConfirmBookmarks(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.confirmSelection()
      })

      expect(onPreviewReady).toHaveBeenCalledOnce()
      expect(onPreviewReady.mock.calls[0]?.[0]).not.toHaveProperty('target')
      expect(onPreviewReady.mock.calls[0]?.[0]).toMatchObject({
        suggestedName: 'Work',
      })
      expect(result.current.pickerState).toEqual({ status: 'closed' })
    })

    it('previews only the selected bookmarks', async () => {
      const { result, onPreviewReady } = await openAndConfirmFolder(
        createTestState({ collections: [reference] }),
        vi.fn(),
        linksFolder,
        linksTree,
      )

      act(() => {
        result.current.clearBookmarks()
      })
      act(() => {
        result.current.toggleBookmark('c')
      })
      act(() => {
        result.current.confirmBookmarks()
      })
      act(() => {
        result.current.confirmSelection()
      })

      expect(onPreviewReady.mock.calls[0]?.[0]).toMatchObject({
        resources: [{ name: 'Vitest', url: 'https://vitest.dev/' }],
      })
    })

    it('builds a preview into the chosen collection, skipping bookmarks it already has', async () => {
      const { result, onPreviewReady } = await openAndConfirmBookmarks(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.selectTarget('reference')
      })
      act(() => {
        result.current.confirmSelection()
      })

      expect(onPreviewReady).toHaveBeenCalledOnce()
      expect(onPreviewReady.mock.calls[0]?.[0]).toMatchObject({
        target: { id: 'reference', name: 'Reference' },
        suggestedName: 'Reference',
        resources: [],
        skippedDuplicateCount: 1,
      })
      expect(result.current.pickerState).toEqual({ status: 'closed' })
    })

    it('falls back to a new collection and stays on the destination step when the chosen collection was deleted', async () => {
      const onPreviewReady = vi.fn()
      let state = createTestState({ collections: [reference] })
      const { result, rerender } = renderHook(() =>
        useBookmarkImport({
          adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
          state,
          onPreviewReady,
        }),
      )

      await act(async () => {
        await result.current.open()
      })
      act(() => {
        result.current.selectFolder(workFolder)
      })
      act(() => {
        result.current.confirmFolder()
      })
      act(() => {
        result.current.confirmBookmarks()
      })
      act(() => {
        result.current.selectTarget('reference')
      })

      state = createTestState({ collections: [] })
      rerender()

      act(() => {
        result.current.confirmSelection()
      })

      expect(onPreviewReady).not.toHaveBeenCalled()
      expect(result.current.pickerState).toMatchObject({
        status: 'choosing-destination',
        selectedFolder: workFolder,
        selectedTargetId: undefined,
      })
    })
  })

  it('does nothing when a later step is confirmed without having reached it', async () => {
    const onPreviewReady = vi.fn()
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
        state: createTestState(),
        onPreviewReady,
      }),
    )

    await act(async () => {
      await result.current.open()
    })
    act(() => {
      result.current.confirmFolder()
    })
    act(() => {
      result.current.confirmBookmarks()
    })
    act(() => {
      result.current.confirmSelection()
    })
    act(() => {
      result.current.back()
    })

    expect(onPreviewReady).not.toHaveBeenCalled()
    expect(result.current.pickerState.status).toBe('picking')
  })

  it('closes and discards the selection on cancel', async () => {
    const onPreviewReady = vi.fn()
    const { result } = renderHook(() =>
      useBookmarkImport({
        adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
        state: createTestState(),
        onPreviewReady,
      }),
    )

    await act(async () => {
      await result.current.open()
    })
    act(() => {
      result.current.selectFolder(workFolder)
    })
    act(() => {
      result.current.close()
    })

    expect(result.current.pickerState).toEqual({ status: 'closed' })
    expect(onPreviewReady).not.toHaveBeenCalled()
  })
})
