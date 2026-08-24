import { useMemo, useState } from 'react'
import type { Collection, WebsiteResource } from '../model/collection.types'
import { getReadableWebsiteDomain } from '../model/website-url'

interface UseCollectionSearchResult {
  readonly query: string
  readonly setQuery: (query: string) => void
  readonly filteredCollections: readonly Collection[]
}

/**
 * Filters collections by name, website name, or website domain.
 * A collection whose own name matches is kept in full; a collection that
 * matches only through some of its websites is narrowed to those websites.
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

function resourceMatches(resource: WebsiteResource, term: string): boolean {
  return (
    resource.name.toLowerCase().includes(term) ||
    getReadableWebsiteDomain(resource.url).toLowerCase().includes(term)
  )
}
