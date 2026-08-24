// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTestCollection,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { emptyCollectionDroppableId } from '../model/resource-drag'
import { useResourceDrag } from './use-resource-drag'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useResourceDrag', () => {
  it('reorders within a collection and highlights the moved resource', () => {
    const first = createTestWebsiteResource({ id: 'resource-1' })
    const second = createTestWebsiteResource({
      id: 'resource-2',
      name: 'Second',
      url: 'https://second.example.com/',
    })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [first, second] }),
    ]
    const onReorder = vi.fn()
    const onMove = vi.fn()
    const { result } = renderHook(() =>
      useResourceDrag({ collections, onReorder, onMove }),
    )

    act(() => result.current.handleDragEnd('resource-1', 'resource-2'))

    expect(onReorder).toHaveBeenCalledWith('collection-1', [
      'resource-2',
      'resource-1',
    ])
    expect(onMove).not.toHaveBeenCalled()
    expect(result.current.highlightedResourceId).toBe('resource-1')
  })

  it('live-previews a resource crossing into a different collection', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const existing = createTestWebsiteResource({
      id: 'resource-1',
      name: 'Existing',
      url: 'https://existing.example.com/',
    })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [moved] }),
      createTestCollection({ id: 'collection-2', resources: [existing] }),
    ]
    const { result } = renderHook(() =>
      useResourceDrag({
        collections,
        onReorder: vi.fn(),
        onMove: vi.fn(),
      }),
    )

    act(() => result.current.handleDragOver('resource-moved', 'resource-1'))

    expect(
      result.current.renderedCollections.find(c => c.id === 'collection-1')
        ?.resources,
    ).toEqual([])
    expect(
      result.current.renderedCollections.find(c => c.id === 'collection-2')
        ?.resources.map(resource => resource.id),
    ).toEqual(['resource-moved', 'resource-1'])
  })

  it('moves a resource into a different collection on drag end', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [moved] }),
      createTestCollection({ id: 'collection-2', resources: [] }),
    ]
    const onReorder = vi.fn()
    const onMove = vi.fn()
    const { result } = renderHook(() =>
      useResourceDrag({ collections, onReorder, onMove }),
    )

    act(() =>
      result.current.handleDragOver(
        'resource-moved',
        emptyCollectionDroppableId('collection-2'),
      ),
    )
    act(() =>
      result.current.handleDragEnd(
        'resource-moved',
        emptyCollectionDroppableId('collection-2'),
      ),
    )

    expect(onMove).toHaveBeenCalledWith(
      'collection-1',
      'collection-2',
      'resource-moved',
      0,
    )
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.renderedCollections).toBe(collections)
  })

  it('discards the live preview and does not persist anything when cancelled', () => {
    const moved = createTestWebsiteResource({ id: 'resource-moved' })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [moved] }),
      createTestCollection({ id: 'collection-2', resources: [] }),
    ]
    const onReorder = vi.fn()
    const onMove = vi.fn()
    const { result } = renderHook(() =>
      useResourceDrag({ collections, onReorder, onMove }),
    )

    act(() =>
      result.current.handleDragOver(
        'resource-moved',
        emptyCollectionDroppableId('collection-2'),
      ),
    )
    act(() => result.current.cancelDrag())

    expect(result.current.renderedCollections).toBe(collections)
    expect(onReorder).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()
  })

  it('does nothing when the drag ends over nothing', () => {
    const collections = [
      createTestCollection({
        id: 'collection-1',
        resources: [createTestWebsiteResource()],
      }),
    ]
    const onReorder = vi.fn()
    const onMove = vi.fn()
    const { result } = renderHook(() =>
      useResourceDrag({ collections, onReorder, onMove }),
    )

    act(() => result.current.handleDragEnd('resource-1', undefined))

    expect(onReorder).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()
    expect(result.current.highlightedResourceId).toBeUndefined()
  })
})
