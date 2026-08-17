// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestCollection } from '../test/collection.fixtures'
import { useCollectionDrag } from './use-collection-drag'

afterEach(() => {
  cleanup()
})

describe('useCollectionDrag', () => {
  it('reorders the collections and highlights the moved card', () => {
    const collections = [
      createTestCollection({ id: 'collection-1', name: 'First' }),
      createTestCollection({ id: 'collection-2', name: 'Second' }),
      createTestCollection({ id: 'collection-3', name: 'Third' }),
    ]
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useCollectionDrag({ collections, onReorder }),
    )

    act(() => result.current.handleDragEnd('collection-1', 'collection-3'))

    expect(onReorder).toHaveBeenCalledWith([
      'collection-2',
      'collection-3',
      'collection-1',
    ])
    expect(result.current.highlightedCollectionId).toBe('collection-1')
  })

  it('does nothing when dropped in the same position', () => {
    const collections = [createTestCollection({ id: 'collection-1' })]
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useCollectionDrag({ collections, onReorder }),
    )

    act(() => result.current.handleDragEnd('collection-1', 'collection-1'))

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('does nothing when dropped over nothing', () => {
    const collections = [createTestCollection({ id: 'collection-1' })]
    const onReorder = vi.fn()
    const { result } = renderHook(() =>
      useCollectionDrag({ collections, onReorder }),
    )

    act(() => result.current.handleDragEnd('collection-1', undefined))

    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.highlightedCollectionId).toBeUndefined()
  })
})
