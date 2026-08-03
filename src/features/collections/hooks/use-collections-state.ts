import { useCallback, useEffect, useState } from 'react'
import type { CollectionsState } from '../model/collection.types'
import type { CollectionsRepository } from '../storage/collections.repository'
import { createEmptyCollectionsState } from '../storage/stored-collections-state'

/** The possible states of the initial collections load. */
export type CollectionsLoadStatus = 'loading' | 'ready' | 'error'

/**
 * Loads collections and stays synchronized with other extension contexts.
 */
export function useCollectionsState(
  repository: CollectionsRepository,
): {
  readonly state: CollectionsState
  readonly status: CollectionsLoadStatus
  readonly save: (state: CollectionsState) => Promise<void>
} {
  const [state, setState] = useState<CollectionsState>(
    createEmptyCollectionsState,
  )
  const [status, setStatus] = useState<CollectionsLoadStatus>('loading')

  useEffect(() => {
    let active = true
    let receivedStorageUpdate = false

    const unsubscribe = repository.subscribe(state => {
      if (!active) {
        return
      }

      receivedStorageUpdate = true
      setState(state)
      setStatus('ready')
    })

    void repository
      .load()
      .then(state => {
        if (active && !receivedStorageUpdate) {
          setState(state)
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

  /** Persists a valid state and updates this page without waiting for an event. */
  const save = useCallback(
    async (nextState: CollectionsState): Promise<void> => {
      await repository.save(nextState)
      setState(nextState)
      setStatus('ready')
    },
    [repository],
  )

  return { state, status, save }
}
