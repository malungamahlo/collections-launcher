/** A file the user picked: its live handle and the file read through it. */
export interface PickedFile {
  /** A reference to the user's own file; storing it avoids keeping a copy of the bytes. */
  readonly handle: FileSystemFileHandle
  /** The file's current metadata and content, read through the handle. */
  readonly file: File
}

/** Which file types the picker should offer. */
export interface FilePickerAcceptType {
  readonly description?: string
  /** MIME type -> the extensions that go with it, e.g. `{ 'application/pdf': ['.pdf'] }`. */
  readonly accept: Record<string, string[]>
}

/** Why a file could not be picked. Cancelling is not an error. */
export type FilePickerErrorCode =
  /** This browser has no File System Access API. */
  | 'UNSUPPORTED'
  /** The file was picked but could not be read. */
  | 'UNREADABLE'
  /** The picker itself failed for another reason. */
  | 'UNAVAILABLE'

/** A predictable failure while picking a file. */
export class FilePickerError extends Error {
  constructor(
    readonly code: FilePickerErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options)
    this.name = 'FilePickerError'
  }
}

/** Defines the native single-file picker needed by application code. */
export interface FilePickerAdapter {
  /**
   * Opens the browser's file picker, restricted to `types`, and returns the
   * chosen file — or `undefined` if the user dismissed the picker.
   * @throws FilePickerError when the picker is unsupported or the file can't be read.
   */
  pickFile(
    types: readonly FilePickerAcceptType[],
  ): Promise<PickedFile | undefined>
}

/** The shape of `window.showOpenFilePicker`, which this DOM lib does not declare. */
type ShowOpenFilePicker = (options: {
  readonly multiple: boolean
  readonly excludeAcceptAllOption: boolean
  readonly types: FilePickerAcceptType[]
}) => Promise<FileSystemFileHandle[]>

/**
 * Picks a file with the File System Access API. It must be called from a user
 * gesture (a click), as the browser requires. Unlike a plain `<input
 * type="file">`, it returns a persistent handle, which is what lets a resource
 * reference the user's file instead of copying it.
 */
export class BrowserFilePickerAdapter implements FilePickerAdapter {
  async pickFile(
    types: readonly FilePickerAcceptType[],
  ): Promise<PickedFile | undefined> {
    const showOpenFilePicker = (
      globalThis as { showOpenFilePicker?: ShowOpenFilePicker }
    ).showOpenFilePicker

    if (typeof showOpenFilePicker !== 'function') {
      throw new FilePickerError(
        'UNSUPPORTED',
        'This browser cannot add files. Try a recent version of Chrome.',
      )
    }

    let handles: FileSystemFileHandle[]

    try {
      handles = await showOpenFilePicker.call(globalThis, {
        multiple: false,
        // Only offer formats the registry knows how to describe and open.
        excludeAcceptAllOption: true,
        types: [...types],
      })
    } catch (error) {
      if (isAbortError(error)) {
        return undefined
      }

      throw new FilePickerError('UNAVAILABLE', 'The file picker could not be opened.', {
        cause: error,
      })
    }

    const handle = handles[0]

    if (!handle) {
      return undefined
    }

    try {
      return { handle, file: await handle.getFile() }
    } catch (error) {
      throw new FilePickerError('UNREADABLE', 'That file could not be read.', {
        cause: error,
      })
    }
  }
}

/** Whether a thrown value is the DOMException the picker raises when dismissed. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}
