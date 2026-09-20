import { useMemo, useState } from 'react'
import type { Collection, CollectionResource } from '../model/collection.types'
import { isWebsiteResource } from '../model/resource.guards'
import { getReadableWebsiteDomain } from '../model/website-url'

interface UseCollectionSearchResult {
  readonly query: string
  readonly setQuery: (query: string) => void
  readonly filteredCollections: readonly Collection[]
}

/**
 * Filters collections by collection name, resource name, or website domain.
 * A collection whose own name matches is kept in full; a collection that
 * matches only through some of its resources is narrowed to those resources.
 */
export function useCollectionSearch(
  collections: readonly Collection[],
): UseCollectionSearchResult {
  const [query, setQuery] = useState('')

  const filteredCollections = useMemo(
    () => filterCollections(collections, query),
    [collections, query],
  )

  return { query, setQuery, filteredCollections }
}

function filterCollections(
  collections: readonly Collection[],
  query: string,
): readonly Collection[] {
  const term = query.trim().toLowerCase()

  if (!term) {
    return collections
  }

  const matchedCollections: Collection[] = []

  for (const collection of collections) {
    if (collection.name.toLowerCase().includes(term)) {
      matchedCollections.push(collection)
      continue
    }

    const matchingResources = collection.resources.filter(resource =>
      resourceMatches(resource, term),
    )

    if (matchingResources.length > 0) {
      matchedCollections.push({ ...collection, resources: matchingResources })
    }
  }

  return matchedCollections
}

/**
 * A resource matches on its name. A website also matches on its domain; a
 * file has no domain, so it matches on its name alone.
 */
function resourceMatches(resource: CollectionResource, term: string): boolean {
  if (resource.name.toLowerCase().includes(term)) {
    return true
  }

  return (
    isWebsiteResource(resource) &&
    getReadableWebsiteDomain(resource.url).toLowerCase().includes(term)
  )
}
