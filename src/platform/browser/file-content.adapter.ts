import type { ResourceId } from '@app/features/collections/model/collection.types'

/** Why a file's content could not be loaded. */
export type FileContentErrorCode =
  /** Nothing is stored for the resource, or the referenced file no longer exists. */
  | 'NOT_FOUND'
  /** The browser holds a reference to the file but read access was not granted. */
  | 'PERMISSION_DENIED'
  /** Anything else — the storage layer or the file system failed unexpectedly. */
  | 'UNAVAILABLE'

/** A predictable failure while reading or writing a resource's file content. */
export class FileContentError extends Error {
  constructor(
    readonly code: FileContentErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options)
    this.name = 'FileContentError'
  }
}

/**
 * Where a resource's bytes live. Every file a collection holds is stored as a
 * **copy** (`blob`): the collection owns it, the way a file uploaded to a chat
 * belongs to the chat, and the user's original on disk is never read again or
 * changed. (Decided with the user on 2026-10-11; see
 * `plans/v3/05-owned-file-storage-and-editing-decision.md`.)
 *
 * `handle` is how files were stored before that: a live reference to the
 * user's own file. Nothing writes one any more. An entry of this kind is
 * still read, and is replaced by a copy (**adopted**) the first time it can
 * be read.
 */
export type StoredFileContent =
  | { readonly kind: 'handle'; readonly handle: FileSystemFileHandle }
  | { readonly kind: 'blob'; readonly blob: Blob }

/**
 * The narrow key-value store `BrowserFileContentAdapter` persists into,
 * keyed by resource id. IndexedDB implements it in the browser
 * (`IndexedDbFileContentStore`); tests inject an in-memory one.
 */
export interface FileContentStore {
  get(id: ResourceId): Promise<StoredFileContent | undefined>
  put(id: ResourceId, content: StoredFileContent): Promise<void>
  /** Removes the entry for `id`; a missing entry is not an error. */
  delete(id: ResourceId): Promise<void>
}

/** What happened when an older, referenced file was offered for adoption. */
export type AdoptionOutcome =
  /** The reference was replaced by a copy of the file. */
  | 'adopted'
  /** It was already a copy; nothing to do. */
  | 'already-owned'
  /** The browser would have to ask the user for access first, which needs a click. */
  | 'needs-access'
  /** Nothing is stored for the resource, or the file it referenced is gone or unreadable. */
  | 'unavailable'

/**
 * Stores and retrieves the bytes behind `FileResource`s. Callers ask only for
 * `load(id)` and get a `Blob` back; nothing outside the adapter needs to know
 * how a given resource is stored.
 */
export interface FileContentAdapter {
  /** Stores a copy of a file's bytes as the resource's content, replacing any it had. */
  saveBlob(id: ResourceId, blob: Blob): Promise<void>
  /**
   * Returns the file's content. An older entry that is still a reference is
   * read through it — asking the user for access if that has lapsed, which
   * needs a click — and then adopted, so this is the last time it depends on
   * the original.
   * @throws FileContentError with a `code` saying why it could not be read.
   */
  load(id: ResourceId): Promise<Blob>
  /**
   * Replaces an older reference with a copy **without ever prompting**: only
   * when the browser still has access to the original. Safe to call for any
   * resource, at any time; never throws.
   */
  adopt(id: ResourceId): Promise<AdoptionOutcome>
  /** Forgets the resource's content. A resource with none stored is not an error. */
  remove(id: ResourceId): Promise<void>
}

/** The permission methods every file-system handle has in Chrome but the DOM lib omits. */
interface PermissionedFileHandle extends FileSystemFileHandle {
  queryPermission(descriptor?: {
    readonly mode?: 'read' | 'readwrite'
  }): Promise<PermissionState>
  requestPermission(descriptor?: {
    readonly mode?: 'read' | 'readwrite'
  }): Promise<PermissionState>
}

const READ_ACCESS = { mode: 'read' } as const

/** Whether an unknown thrown value is a DOMException with one of the given names. */
function isDomError(error: unknown, ...names: string[]): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof error.name === 'string' &&
    names.includes(error.name)
  )
}

/**
 * Reads a file through its handle, first making sure read access is granted.
 * A handle restored from storage may need its permission re-granted after a
 * browser restart; `requestPermission` can show a prompt but needs a user
 * gesture, so a refusal — including "no gesture" — is `PERMISSION_DENIED`.
 */
async function readHandle(handle: FileSystemFileHandle): Promise<File> {
  const permissioned = handle as PermissionedFileHandle

  try {
    if ((await permissioned.queryPermission(READ_ACCESS)) !== 'granted') {
      const requested = await permissioned.requestPermission(READ_ACCESS)

      if (requested !== 'granted') {
        throw new FileContentError(
          'PERMISSION_DENIED',
          `Read access to "${handle.name}" was not granted.`,
        )
      }
    }

    return await handle.getFile()
  } catch (error) {
    if (error instanceof FileContentError) {
      throw error
    }

    if (isDomError(error, 'NotFoundError')) {
      throw new FileContentError(
        'NOT_FOUND',
        `"${handle.name}" could not be found. It may have been moved or deleted.`,
        { cause: error },
      )
    }

    if (isDomError(error, 'NotAllowedError', 'SecurityError')) {
      throw new FileContentError(
        'PERMISSION_DENIED',
        `Read access to "${handle.name}" was not granted.`,
        { cause: error },
      )
    }

    throw new FileContentError(
      'UNAVAILABLE',
      `"${handle.name}" could not be read.`,
      { cause: error },
    )
  }
}

/**
 * Stores file content in a `FileContentStore` (IndexedDB by default in the
 * running extension), keyed by the resource's own id.
 */
export class BrowserFileContentAdapter implements FileContentAdapter {
  constructor(private readonly store: FileContentStore) {}

  async saveBlob(id: ResourceId, blob: Blob): Promise<void> {
    await this.store.put(id, { kind: 'blob', blob })
  }

  async load(id: ResourceId): Promise<Blob> {
    const stored = await this.store.get(id)

    if (!stored) {
      throw new FileContentError(
        'NOT_FOUND',
        `No file content is stored for resource "${id}".`,
      )
    }

    if (stored.kind === 'blob') {
      return stored.blob
    }

    const file = await readHandle(stored.handle)

    // The file is in hand, so take the chance to own it. If that fails (the
    // disk is full, the file changed mid-read) the file just read is still
    // returned: opening it matters more than adopting it, which can wait.
    try {
      return await this.replaceWithCopy(id, file)
    } catch (error) {
      console.error(`Could not adopt file resource ${id}`, error)

      return file
    }
  }

  async adopt(id: ResourceId): Promise<AdoptionOutcome> {
    try {
      const stored = await this.store.get(id)

      if (!stored) {
        return 'unavailable'
      }

      if (stored.kind === 'blob') {
        return 'already-owned'
      }

      const handle = stored.handle as PermissionedFileHandle

      if ((await handle.queryPermission(READ_ACCESS)) !== 'granted') {
        return 'needs-access'
      }

      await this.replaceWithCopy(id, await handle.getFile())

      return 'adopted'
    } catch {
      return 'unavailable'
    }
  }

  async remove(id: ResourceId): Promise<void> {
    await this.store.delete(id)
  }

  /**
   * Stores a copy of `file` in place of whatever `id` had, and returns it.
   * The bytes are read into memory first: a `File` from a handle is only a
   * view of the file on disk, and storing the view could capture a file that
   * changes, or vanishes, while it is being written.
   */
  private async replaceWithCopy(id: ResourceId, file: File): Promise<Blob> {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })

    await this.store.put(id, { kind: 'blob', blob })

    return blob
  }
}
