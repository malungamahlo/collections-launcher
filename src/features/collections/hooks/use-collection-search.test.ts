// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createTestCollection,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { useCollectionSearch } from './use-collection-search'

afterEach(() => {
  cleanup()
})

describe('useCollectionSearch', () => {
  it('returns every collection unchanged for an empty query', () => {
    const collections = [
      createTestCollection({ id: 'collection-1', name: 'Development' }),
      createTestCollection({ id: 'collection-2', name: 'Research' }),
    ]
    const { result } = renderHook(() => useCollectionSearch(collections))

    expect(result.current.filteredCollections).toBe(collections)
  })

  it('keeps a collection in full when its own name matches', () => {
    const resource = createTestWebsiteResource({ name: 'YouTube' })
    const collections = [
      createTestCollection({
        id: 'collection-1',
        name: 'Development',
        resources: [resource],
      }),
      createTestCollection({ id: 'collection-2', name: 'Research' }),
    ]
    const { result } = renderHook(() => useCollectionSearch(collections))

    act(() => result.current.setQuery('develop'))

    expect(result.current.filteredCollections).toEqual([
      collections[0],
    ])
  })

  it('narrows a collection to only the websites matching by name', () => {
    const matching = createTestWebsiteResource({
      id: 'resource-1',
      name: 'GitHub',
      url: 'https://github.com/',
    })
    const nonMatching = createTestWebsiteResource({
      id: 'resource-2',
      name: 'YouTube',
      url: 'https://youtube.com/',
    })
    const collections = [
      createTestCollection({
        id: 'collection-1',
        name: 'Development',
        resources: [matching, nonMatching],
      }),
    ]
    const { result } = renderHook(() => useCollectionSearch(collections))

    act(() => result.current.setQuery('github'))

    expect(result.current.filteredCollections).toEqual([
      { ...collections[0], resources: [matching] },
    ])
  })

  it('matches websites by domain', () => {
    const resource = createTestWebsiteResource({
      name: 'My videos',
      url: 'https://youtube.com/watch',
    })
    const collections = [
      createTestCollection({ id: 'collection-1', resources: [resource] }),
    ]
    const { result } = renderHook(() => useCollectionSearch(collections))

    act(() => result.current.setQuery('youtube'))

    expect(result.current.filteredCollections).toEqual([
      { ...collections[0], resources: [resource] },
    ])
  })

  it('is case-insensitive and ignores surrounding whitespace', () => {
    const collections = [
      createTestCollection({ id: 'collection-1', name: 'Development' }),
    ]
    const { result } = renderHook(() => useCollectionSearch(collections))

    act(() => result.current.setQuery('  DEVELOP  '))

    expect(result.current.filteredCollections).toEqual(collections)
  })

  it('excludes collections with no matching name or website', () => {
    const collections = [
      createTestCollection({ id: 'collection-1', name: 'Development' }),
    ]
    const { result } = renderHook(() => useCollectionSearch(collections))

    act(() => result.current.setQuery('nothing matches this'))

    expect(result.current.filteredCollections).toEqual([])
  })
})
