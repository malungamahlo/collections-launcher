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
 * Where a resource's bytes live. A locally added file is stored as a live
 * *reference* to the user's own file, so no second copy of its bytes exists
 * and opening it always shows its current content. A file that arrived by
 * import has no location on this machine to point at, so its bytes are
 * stored as a `Blob` — the one case where a copy is the only option.
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

/**
 * Stores and retrieves the bytes behind `FileResource`s. Callers ask only for
 * `load(id)` and get a `Blob` back; nothing outside the adapter needs to know
 * whether a given resource is a reference or a stored copy.
 */
export interface FileContentAdapter {
  /** Stores a live reference to a file the user picked with the File System Access API. */
  saveHandle(id: ResourceId, handle: FileSystemFileHandle): Promise<void>
  /** Stores a copy of a file's bytes, for content with no local file to reference. */
  saveBlob(id: ResourceId, blob: Blob): Promise<void>
  /**
   * Returns the file's current content, whichever form it is stored in.
   * @throws FileContentError with a `code` saying why it could not be read.
   */
  load(id: ResourceId): Promise<Blob>
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
 * running extension), holding a handle for files added locally and a `Blob`
 * for files that arrived by import, both keyed by the resource's own id.
 */
export class BrowserFileContentAdapter implements FileContentAdapter {
  constructor(private readonly store: FileContentStore) {}

  async saveHandle(id: ResourceId, handle: FileSystemFileHandle): Promise<void> {
    await this.store.put(id, { kind: 'handle', handle })
  }

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

    return stored.kind === 'blob' ? stored.blob : readHandle(stored.handle)
  }

  async remove(id: ResourceId): Promise<void> {
    await this.store.delete(id)
  }
}
