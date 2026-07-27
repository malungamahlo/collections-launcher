import type { CollectionsState } from '../model/collection.types'

/** Receives the latest valid state when persisted collections change. */
export type CollectionsStateListener = (state: CollectionsState) => void

/** Stops an active repository subscription. */
export type Unsubscribe = () => void

/**
 * Defines how application code accesses persisted collection data.
 *
 * Implementations may use Chrome storage, memory, sync storage,
 * or a remote service without changing domain or React code.
 */
export interface CollectionsRepository {
  /** Loads the latest valid collections state. */
  load(): Promise<CollectionsState>

  /** Replaces the persisted state with the supplied valid state. */
  save(state: CollectionsState): Promise<void>

  /**
   * Observes state changes made by another extension context,
   * such as the toolbar popup or new-tab page.
   */
  subscribe(listener: CollectionsStateListener): Unsubscribe
}
