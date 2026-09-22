import { browser, type Browser } from 'wxt/browser'

/** Why handing a file to another application did not work. */
export type ExternalOpenErrorCode =
  /** The browser permissions this needs have not been given. */
  | 'NO_ACCESS'
  /** The temporary copy could not be written. */
  | 'COPY_FAILED'
  /** The browser only opens a file for a few seconds after a click, and that moment has passed. */
  | 'NEEDS_GESTURE'
  /** The browser could not open the copy. */
  | 'OPEN_FAILED'

/** A predictable failure while opening a file in another application. */
export class ExternalOpenError extends Error {
  constructor(
    readonly code: ExternalOpenErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options)
    this.name = 'ExternalOpenError'
  }
}

/** A temporary copy of a file, written and ready to be opened. */
export interface PreparedExternalFile {
  /** Identifies the copy to the browser. */
  readonly id: number
  readonly fileName: string
}

/**
 * Opens a file in the operating system's own application — Word for a `.docx`,
 * and so on.
 *
 * A browser extension cannot open a file where it already lives: a file handle
 * never reveals its path, and an extension cannot launch other programs. The
 * only way is a *temporary copy* the operating system can open. This adapter
 * makes that copy invisible to the user — no download bubble, no notification —
 * and removes it again once the application has let go of it. A copy that
 * lasts is something the user asks for (`FileDownloadAdapter`), never
 * something this creates.
 */
export interface ExternalOpenAdapter {
  /** Whether the browser permissions this needs are already granted. */
  hasAccess(): Promise<boolean>
  /**
   * Asks the user for them, which shows a browser prompt the first time. Must be
   * called straight from a click. Resolves to whether they were granted.
   */
  requestAccess(): Promise<boolean>
  /**
   * Writes a temporary copy of `content` where the operating system can open
   * it, without showing the browser's download interface.
   * @throws ExternalOpenError
   */
  prepare(fileName: string, content: Blob): Promise<PreparedExternalFile>
  /**
   * Opens a prepared copy in the application registered for it. The browser
   * only allows this for a few seconds after a click.
   * @throws ExternalOpenError with `NEEDS_GESTURE` once that moment has passed.
   */
  open(file: PreparedExternalFile): Promise<void>
  /**
   * Deletes temporary copies that are no longer needed, and makes sure the
   * browser's download interface is switched back on. Never throws.
   */
  cleanUp(): Promise<void>
}

/**
 * What the browser has to allow for any of this. `downloads` writes the copy,
 * `downloads.open` opens it, and `downloads.ui` hides the browser's download
 * bubble while it is written. Keep in step with `DOWNLOAD_PERMISSIONS` in
 * `wxt.config.ts`.
 */
const DOWNLOAD_PERMISSIONS: Browser.permissions.Permissions = {
  permissions: ['downloads', 'downloads.open', 'downloads.ui'],
}

/** Where, inside the user's Downloads folder, temporary copies are written. */
const TEMPORARY_FOLDER = 'Collections Launcher (temporary)'

/** How long to wait for a copy to finish being written. */
const COPY_TIMEOUT_MS = 60_000

/**
 * A copy younger than this is left alone by `cleanUp`, so an application that
 * is still starting up is not pulled out from under.
 */
const MINIMUM_COPY_AGE_MS = 2 * 60_000

/** `browser.downloads` exists only once the permission is granted. */
function getDownloads(): typeof browser.downloads | undefined {
  return (browser as { downloads?: typeof browser.downloads }).downloads
}

function requireDownloads(): typeof browser.downloads {
  const downloads = getDownloads()

  if (!downloads) {
    throw new ExternalOpenError(
      'NO_ACCESS',
      'The browser has not given this extension access to downloads.',
    )
  }

  return downloads
}

/** Resolves once the download has finished writing the file. */
function waitForCompletion(
  downloads: typeof browser.downloads,
  id: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false

    const settle = (action: () => void): void => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      downloads.onChanged.removeListener(onChanged)
      action()
    }
    const succeed = (): void => settle(resolve)
    const fail = (message: string): void =>
      settle(() => reject(new ExternalOpenError('COPY_FAILED', message)))

    const onChanged = (delta: { id: number; state?: { current?: string } }) => {
      if (delta.id !== id) {
        return
      }

      if (delta.state?.current === 'complete') {
        succeed()
      } else if (delta.state?.current === 'interrupted') {
        fail('Writing the temporary copy was interrupted.')
      }
    }
    const timer = setTimeout(
      () => fail('Writing the temporary copy took too long.'),
      COPY_TIMEOUT_MS,
    )

    downloads.onChanged.addListener(onChanged)

    // A small file can finish before the listener above exists.
    void downloads
      .search({ id })
      .then(([item]) => {
        if (item?.state === 'complete') {
          succeed()
        } else if (item?.state === 'interrupted') {
          fail('Writing the temporary copy was interrupted.')
        }
      })
      .catch(() => undefined)
  })
}

/** Turns whatever `downloads.open` rejected with into a typed error. */
function toOpenError(error: unknown): ExternalOpenError {
  const message = error instanceof Error ? error.message : String(error)

  // Chrome words it "User gesture required".
  return /gesture/i.test(message)
    ? new ExternalOpenError('NEEDS_GESTURE', message, { cause: error })
    : new ExternalOpenError('OPEN_FAILED', message, { cause: error })
}

/**
 * Opens files through Chrome's downloads API: a blob is written into a
 * dedicated folder inside the Downloads folder, opened with
 * `downloads.open`, and deleted later by `cleanUp`.
 *
 * Every download this extension starts through the API is one of these
 * temporary copies (an explicit save uses `FileDownloadAdapter`, which is not
 * an API download), so `cleanUp` recognises them by `byExtensionId`.
 */
export class BrowserExternalOpenAdapter implements ExternalOpenAdapter {
  /**
   * How many copies are being written right now. The download interface is
   * hidden for all of them and shown again when the last one is done.
   */
  private copiesInProgress = 0
  /** The hiding that the first copy started, which every later copy waits for too. */
  private hiding: Promise<void> | undefined

  async hasAccess(): Promise<boolean> {
    try {
      return await browser.permissions.contains(DOWNLOAD_PERMISSIONS)
    } catch {
      return false
    }
  }

  async requestAccess(): Promise<boolean> {
    try {
      return await browser.permissions.request(DOWNLOAD_PERMISSIONS)
    } catch {
      // Chrome refuses a request that does not come straight from a click.
      return false
    }
  }

  async prepare(fileName: string, content: Blob): Promise<PreparedExternalFile> {
    const downloads = requireDownloads()
    const objectUrl = URL.createObjectURL(content)

    await this.hideDownloadInterface()

    try {
      const id = await downloads.download({
        url: objectUrl,
        // A folder of its own per copy, so two files with one name never clash.
        filename: `${TEMPORARY_FOLDER}/${crypto.randomUUID()}/${fileName}`,
        conflictAction: 'uniquify',
        saveAs: false,
      })

      await waitForCompletion(downloads, id)

      return { id, fileName }
    } catch (error) {
      throw error instanceof ExternalOpenError
        ? error
        : new ExternalOpenError(
            'COPY_FAILED',
            `Could not write a temporary copy of "${fileName}".`,
            { cause: error },
          )
    } finally {
      URL.revokeObjectURL(objectUrl)
      await this.showDownloadInterface()
    }
  }

  async open(file: PreparedExternalFile): Promise<void> {
    const downloads = requireDownloads()

    try {
      await downloads.open(file.id)
    } catch (error) {
      throw toOpenError(error)
    }
  }

  async cleanUp(): Promise<void> {
    const downloads = getDownloads()

    if (!downloads) {
      return
    }

    // A page that closed while the interface was hidden would have left it
    // hidden for every download in the browser.
    await this.setDownloadInterface(true)
    this.copiesInProgress = 0

    try {
      const olderThan = new Date(Date.now() - MINIMUM_COPY_AGE_MS).toISOString()
      const items = await downloads.search({ startedBefore: olderThan })

      for (const item of items) {
        if (item.byExtensionId === browser.runtime.id) {
          await removeCopy(downloads, item)
        }
      }
    } catch (error) {
      console.error('Could not clean up temporary copies', error)
    }
  }

  /** Hides the download interface for a copy about to be written (the first one hides it for all). */
  private async hideDownloadInterface(): Promise<void> {
    this.copiesInProgress += 1

    if (this.copiesInProgress === 1) {
      this.hiding = this.setDownloadInterface(false)
    }

    await this.hiding
  }

  /** Shows the download interface again once the last copy in progress is done. */
  private async showDownloadInterface(): Promise<void> {
    this.copiesInProgress -= 1

    if (this.copiesInProgress === 0) {
      await this.setDownloadInterface(true)
    }
  }

  /**
   * Hides or shows the browser's download bubble. Best effort: without the
   * permission, or in an older browser, the bubble is simply left as it is.
   */
  private async setDownloadInterface(enabled: boolean): Promise<void> {
    try {
      await getDownloads()?.setUiOptions({ enabled })
    } catch {
      // Nothing to do: the copy is still written, only less discreetly.
    }
  }
}

/**
 * Deletes one temporary copy and forgets it. If the application still has the
 * file open (Windows locks it) the copy and its record are kept, to be tried
 * again next time.
 */
async function removeCopy(
  downloads: typeof browser.downloads,
  item: { readonly id: number; readonly exists: boolean },
): Promise<void> {
  try {
    if (item.exists) {
      await downloads.removeFile(item.id)
    }

    await downloads.erase({ id: item.id })
  } catch {
    // Already gone by other means? Then only the record is left to forget.
    try {
      const [current] = await downloads.search({ id: item.id })

      if (current && !current.exists) {
        await downloads.erase({ id: item.id })
      }
    } catch {
      // Try again next time.
    }
  }
}
