// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestState } from '@app/features/collections/test/collection.fixtures'
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
