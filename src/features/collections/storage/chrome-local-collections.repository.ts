import { browser, type Browser } from 'wxt/browser'
import type { CollectionsState } from '../model/collection.types'
import type {
  CollectionsRepository,
  CollectionsStateListener,
  Unsubscribe,
} from './collections.repository'
import { resolveStoredCollectionsState } from './stored-collections-state'

/** Private key used to store the complete application state. */
const COLLECTIONS_STORAGE_KEY = 'collectionsLauncherState' as const

interface CollectionsStorage {
  readonly collectionsLauncherState?: unknown
}

/**
 * Persists collection state using the extension's local browser storage.
 */
export class ChromeLocalCollectionsRepository
  implements CollectionsRepository
{
  /** Loads persisted state after validating its runtime structure. */
  async load(): Promise<CollectionsState> {
    const storedValues =
      await browser.storage.local.get<CollectionsStorage>(
        COLLECTIONS_STORAGE_KEY,
      )

    return resolveStoredCollectionsState(
      storedValues[COLLECTIONS_STORAGE_KEY],
    ).state
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

      if (!stateChange) {
        return
      }

      listener(resolveStoredCollectionsState(stateChange.newValue).state)
    }

    browser.storage.local.onChanged.addListener(handleChange)

    return () => {
      browser.storage.local.onChanged.removeListener(handleChange)
    }
  }
}
