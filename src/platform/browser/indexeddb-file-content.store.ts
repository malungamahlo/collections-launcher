import type { ResourceId } from '@app/features/collections/model/collection.types'
import type {
  FileContentStore,
  StoredFileContent,
} from './file-content.adapter'

const DATABASE_NAME = 'collections-launcher-files'
const DATABASE_VERSION = 1
const OBJECT_STORE_NAME = 'file-content'

/**
 * A `FileContentStore` backed by IndexedDB: one object store keyed by
 * resource id (out-of-line keys), holding either a `FileSystemFileHandle` or a
 * `Blob` as a structured-cloneable value. This is a separate database from
 * `chrome.storage.local`, which holds the collections themselves — file bytes
 * never go into that store.
 *
 * The connection is opened lazily on first use and reused. Every operation
 * resolves only when its transaction completes, so a resolved write is durable.
 * Failures (including a full disk, `QuotaExceededError`) reject unchanged.
 */
export class IndexedDbFileContentStore implements FileContentStore {
  private connection: Promise<IDBDatabase> | undefined

  /** @param factory The IndexedDB implementation; defaults to the global one. */
  constructor(private readonly factory?: IDBFactory) {}

  async get(id: ResourceId): Promise<StoredFileContent | undefined> {
    const value = await this.run('readonly', store => store.get(id))

    return value as StoredFileContent | undefined
  }

  async put(id: ResourceId, content: StoredFileContent): Promise<void> {
    await this.run('readwrite', store => store.put(content, id))
  }

  async delete(id: ResourceId): Promise<void> {
    await this.run('readwrite', store => store.delete(id))
  }

  /** Opens (and, on first use, creates) the database, sharing one connection. */
  private open(): Promise<IDBDatabase> {
    this.connection ??= new Promise((resolve, reject) => {
      const request = (this.factory ?? indexedDB).open(
        DATABASE_NAME,
        DATABASE_VERSION,
      )

      request.onupgradeneeded = () => {
        request.result.createObjectStore(OBJECT_STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        // Don't cache a failed open; the next call tries again.
        this.connection = undefined
        reject(request.error)
      }
    })

    return this.connection
  }

  /** Runs one request inside its own transaction and resolves once it commits. */
  private async run<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.open()

    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, mode)
      const request = operation(transaction.objectStore(OBJECT_STORE_NAME))

      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? request.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
}
