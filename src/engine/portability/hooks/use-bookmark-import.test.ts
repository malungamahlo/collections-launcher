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

  it('builds a preview from the chosen folder, hands it off, and closes', async () => {
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
      result.current.confirmSelection()
    })

    expect(onPreviewReady).toHaveBeenCalledOnce()
    expect(onPreviewReady.mock.calls[0]?.[0]).toMatchObject({
      suggestedName: 'Work',
      resources: [{ name: 'GitHub', url: 'https://github.com/' }],
      skippedInvalidCount: 1,
    })
    expect(result.current.pickerState).toEqual({ status: 'closed' })
  })

  describe('choosing a destination collection', () => {
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

    async function openAndSelectFolder(
      state: CollectionsState,
      onPreviewReady = vi.fn(),
    ) {
      const rendered = renderHook(() =>
        useBookmarkImport({
          adapter: createAdapter(vi.fn().mockResolvedValue(tree)),
          state,
          onPreviewReady,
        }),
      )

      await act(async () => {
        await rendered.result.current.open()
      })
      act(() => {
        rendered.result.current.selectFolder(workFolder)
      })

      return { ...rendered, onPreviewReady }
    }

    it('records the selected target while picking, and clears it again', async () => {
      const { result } = await openAndSelectFolder(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.selectTarget('reference')
      })

      expect(result.current.pickerState).toMatchObject({
        status: 'picking',
        selectedTargetId: 'reference',
      })

      act(() => {
        result.current.selectTarget(undefined)
      })

      expect(result.current.pickerState).toMatchObject({
        status: 'picking',
        selectedTargetId: undefined,
      })
    })

    it('imports as a new collection by default', async () => {
      const { result, onPreviewReady } = await openAndSelectFolder(
        createTestState({ collections: [reference] }),
      )

      act(() => {
        result.current.confirmSelection()
      })

      expect(onPreviewReady.mock.calls[0]?.[0]).not.toHaveProperty('target')
      expect(onPreviewReady.mock.calls[0]?.[0]).toMatchObject({
        suggestedName: 'Work',
      })
    })

    it('builds a preview into the chosen collection, skipping bookmarks it already has', async () => {
      const { result, onPreviewReady } = await openAndSelectFolder(
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

    it('falls back to a new collection and stays on the picker when the chosen collection was deleted', async () => {
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
        result.current.selectTarget('reference')
      })

      state = createTestState({ collections: [] })
      rerender()

      act(() => {
        result.current.confirmSelection()
      })

      expect(onPreviewReady).not.toHaveBeenCalled()
      expect(result.current.pickerState).toMatchObject({
        status: 'picking',
        selectedFolder: workFolder,
        selectedTargetId: undefined,
      })
    })
  })

  it('does nothing when confirmed without a selected folder', async () => {
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
      result.current.confirmSelection()
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
