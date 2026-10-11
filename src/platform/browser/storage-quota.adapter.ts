/** How much the browser lets this extension store, and how much of that is used. */
export interface StorageEstimate {
  /** The most the extension may store, in bytes. Absent when the browser will not say. */
  readonly quota?: number
  /** How much it stores now, in bytes. Absent when the browser will not say. */
  readonly usage?: number
}

/**
 * What application code needs to know about the browser's storage for the
 * files a collection owns: how much room is left, and a way to ask the browser
 * to keep what is stored.
 */
export interface StorageQuotaAdapter {
  /**
   * The browser's estimate, or `undefined` when it cannot give one. Never
   * throws: not knowing is not a reason to refuse to store a file.
   */
  estimate(): Promise<StorageEstimate | undefined>
  /**
   * Asks the browser to treat what the extension stores as **persistent** —
   * not to be cleared when the disk runs low. Without this a browser may evict
   * stored data, and a collection's files are the only copy the collection
   * has. Resolves to whether storage is persistent afterwards; never throws.
   * An installed extension is normally granted this without a prompt.
   */
  persist(): Promise<boolean>
}

/** `navigator.storage`, where it exists. */
function getStorageManager(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

/** Asks the browser itself, through the Storage API. */
export class BrowserStorageQuotaAdapter implements StorageQuotaAdapter {
  async estimate(): Promise<StorageEstimate | undefined> {
    try {
      return await getStorageManager()?.estimate?.()
    } catch {
      return undefined
    }
  }

  async persist(): Promise<boolean> {
    try {
      const storage = getStorageManager()

      if (!storage?.persist) {
        return false
      }

      // Asking again when it is already persistent is harmless, but skip it.
      return (await storage.persisted?.()) === true || (await storage.persist())
    } catch {
      return false
    }
  }
}
