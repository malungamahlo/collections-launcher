import { useEffect, useState } from 'react'
import type { Collection } from '../model/collection.types'
import type { CollectionsRepository } from '../storage/collections.repository'

/** The possible states of the initial collections load. */
export type CollectionsLoadStatus = 'loading' | 'ready' | 'error'

/**
 * Loads collections and stays synchronized with other extension contexts.
 */
export function useCollectionsState(
  repository: CollectionsRepository,
): {
  readonly collections: readonly Collection[]
  readonly status: CollectionsLoadStatus
} {
  const [collections, setCollections] = useState<readonly Collection[]>([])
  const [status, setStatus] = useState<CollectionsLoadStatus>('loading')

  useEffect(() => {
    let active = true
    let receivedStorageUpdate = false

    const unsubscribe = repository.subscribe(state => {
      if (!active) {
        return
      }

      receivedStorageUpdate = true
      setCollections(state.collections)
      setStatus('ready')
    })

    void repository
      .load()
      .then(state => {
        if (active && !receivedStorageUpdate) {
          setCollections(state.collections)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (active && !receivedStorageUpdate) {
          setStatus('error')
        }
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [repository])

  return { collections, status }
}
