import { browser, type Browser } from 'wxt/browser'
import {
  COLLECTIONS_SCHEMA_VERSION,
  type CollectionsState,
} from '../model/collection.types'
import type {
  CollectionsRepository,
  CollectionsStateListener,
  Unsubscribe,
} from './collections.repository'

/** Private key used to store the complete application state. */
const COLLECTIONS_STORAGE_KEY = 'collectionsLauncherState' as const

interface CollectionsStorage {
  readonly collectionsLauncherState?: CollectionsState
}

/**
 * Creates the valid initial state used when storage is empty.
 */
function createEmptyState(): CollectionsState {
  return {
    schemaVersion: COLLECTIONS_SCHEMA_VERSION,
    collections: [],
  }
}

/**
 * Persists collection state using the extension's local browser storage.
 */
export class ChromeLocalCollectionsRepository
  implements CollectionsRepository
{
  /** Loads persisted state or returns an empty first-run state. */
  async load(): Promise<CollectionsState> {
    const storedValues =
      await browser.storage.local.get<CollectionsStorage>(
        COLLECTIONS_STORAGE_KEY,
      )

    return storedValues[COLLECTIONS_STORAGE_KEY] ?? createEmptyState()
  }

  /** Saves the complete state under one versioned storage key. */
  async save(state: CollectionsState): Promise<void> {
    await browser.storage.local.set<CollectionsStorage>({
      [COLLECTIONS_STORAGE_KEY]: state,
    })
  }

  /**
   * Observes local storage changes made by another extension context.
   */
  subscribe(listener: CollectionsStateListener): Unsubscribe {
    const handleChange = (
      changes: Record<string, Browser.storage.StorageChange>,
    ): void => {
      const stateChange = changes[COLLECTIONS_STORAGE_KEY]

      if (stateChange?.newValue === undefined) {
        return
      }

      listener(stateChange.newValue as CollectionsState)
    }

    browser.storage.local.onChanged.addListener(handleChange)

    return () => {
      browser.storage.local.onChanged.removeListener(handleChange)
    }
  }
}
