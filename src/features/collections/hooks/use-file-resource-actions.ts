import { useEffect, useRef, useState } from 'react'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import {
  ExternalOpenError,
  type ExternalOpenAdapter,
  type PreparedExternalFile,
} from '@app/platform/browser/external-open.adapter'
import type { TabsAdapter } from '@app/platform/browser/tabs.adapter'
import type { FileResource } from '../model/collection.types'
import { getFileResourceFileName } from '../model/file-name'
import { buildFileDocumentUrl } from '../model/file-document-location'
import { buildFileViewerUrl } from '../model/file-viewer-location'
import { getResourceKind, getViewerStrategy } from '../model/resource-kind-registry'
import { describeFileReadFailure } from './file-read-messages'
import { useSaveFileCopy } from './use-save-file-copy'

/**
 * How long "Opened …" stays on screen. Long enough to read the one sentence
 * that matters (it is a temporary copy), short enough not to linger.
 */
const OPENED_NOTICE_DURATION_MS = 10_000

/**
 * When to delete temporary copies after opening one. `cleanUp` leaves a copy
 * alone for its first two minutes, so this is just past that.
 */
const CLEAN_UP_DELAY_MS = 125_000

/** A short message shown over the dashboard about a file action. */
export interface FileActionNotice {
  readonly tone: 'info' | 'error'
  readonly message: string
  /**
   * The label of the one button beside the message, when there is something
   * the user can do. Pressing it calls `runNoticeAction`.
   */
  readonly actionLabel?: string
}

/** How opening a file — in the browser or in another application — is going. */
type ExternalOpenState =
  | { readonly status: 'idle' }
  /** Reading the file and writing the temporary copy. */
  | { readonly status: 'working'; readonly resource: FileResource }
  /**
   * The copy is written, but the browser only opens a file for a few seconds
   * after a click and that moment passed (slow to write, or a first-time
   * permission prompt in the way). One more click opens it.
   */
  | {
      readonly status: 'ready'
      readonly resource: FileResource
      readonly file: PreparedExternalFile
    }
  | { readonly status: 'opened'; readonly resource: FileResource }
  /** The user has not allowed what opening in another application needs. */
  | { readonly status: 'denied'; readonly resource: FileResource }
  | {
      readonly status: 'error'
      readonly resource: FileResource
      readonly message: string
      /** Whether trying again could help. */
      readonly canRetry: boolean
      /** Whether what failed was opening it in its application, so trying again does that. */
      readonly inApp: boolean
    }

interface UseFileResourceActionsOptions {
  readonly fileContent: FileContentAdapter
  /** Only `open` is used: a viewer page opens in the current tab, like a website. */
  readonly tabs: Pick<TabsAdapter, 'open'>
  readonly externalOpen: ExternalOpenAdapter
  readonly fileDownload: FileDownloadAdapter
}

/** Works out what to tell the user about a failure to open a file. */
function toErrorState(
  resource: FileResource,
  error: unknown,
  inApp: boolean,
): Extract<ExternalOpenState, { status: 'denied' | 'error' }> {
  if (error instanceof ExternalOpenError && error.code === 'NO_ACCESS') {
    return { status: 'denied', resource }
  }

  if (error instanceof FileContentError) {
    return {
      status: 'error',
      resource,
      message: describeFileReadFailure(resource.name, error.code),
      canRetry: error.code !== 'NOT_FOUND',
      inApp,
    }
  }

  if (!(error instanceof ExternalOpenError)) {
    console.error(`Could not open file resource ${resource.id}`, error)
  }

  return {
    status: 'error',
    resource,
    message: `"${resource.name}" could not be opened. Try again.`,
    canRetry: true,
    inApp,
  }
}

/**
 * The dashboard's file actions: open a file resource from its row, and save a
 * copy of one.
 *
 * **Opening dispatches on the registry's viewer strategy**, and a file that the
 * browser shows is reached the way a website is: by navigating the current tab,
 * so Back returns to the dashboard. A PDF becomes the browser's own document —
 * Chrome's PDF viewer filling the tab, as if opened from disk — at an address
 * the extension's service worker answers (`serveFileDocument`). A Markdown file
 * is rendered on its own page (`viewer.html`). Anything else
 * is handed to the operating system's own application through a temporary copy
 * that the user is never shown (see `ExternalOpenAdapter`) — no download bubble,
 * and the copy is deleted once the application has let go of it. The only
 * mention is one sentence saying it is a temporary copy, so nobody edits it
 * believing they are editing the original. Websites never come through here.
 *
 * **Click discipline.** `open` and the notice actions must be called straight
 * from a click: the browser shows its permission prompt only for a click, and
 * only opens a file for a few seconds after one. So access is requested before
 * anything is awaited, and the file is opened the moment its copy is written.
 * If that moment has passed, the notice offers an **Open** button (see
 * `runNoticeAction`) — one more click, which the browser then honours.
 *
 * A copy that lasts is only ever made by `save`, an ordinary visible download
 * the user asked for.
 */
export function useFileResourceActions({
  fileContent,
  tabs,
  externalOpen,
  fileDownload,
}: UseFileResourceActionsOptions) {
  const [state, setState] = useState<ExternalOpenState>({ status: 'idle' })
  const saveCopy = useSaveFileCopy({ fileContent, fileDownload })
  // Identifies the latest attempt, so one that finishes late cannot overwrite a newer one.
  const attemptRef = useRef(0)
  const cleanUpTimerRef = useRef<number>(undefined)

  // Copies left over from earlier sessions (an application still had them open
  // when the last one ended) are removed as soon as the dashboard opens.
  useEffect(() => {
    let isActive = true

    void externalOpen.hasAccess().then(hasAccess => {
      if (isActive && hasAccess) {
        void externalOpen.cleanUp()
      }
    })

    return () => {
      isActive = false
    }
  }, [externalOpen])

  useEffect(() => () => window.clearTimeout(cleanUpTimerRef.current), [])

  useEffect(() => {
    if (state.status !== 'opened') {
      return
    }

    const timer = window.setTimeout(
      () => setState({ status: 'idle' }),
      OPENED_NOTICE_DURATION_MS,
    )

    return () => window.clearTimeout(timer)
  }, [state])

  /** Opens a prepared copy. Runs inside a click, so the browser allows it. */
  async function handOver(
    resource: FileResource,
    file: PreparedExternalFile,
    attempt: number,
  ): Promise<void> {
    try {
      await externalOpen.open(file)

      if (attempt !== attemptRef.current) {
        return
      }

      setState({ status: 'opened', resource })
      window.clearTimeout(cleanUpTimerRef.current)
      cleanUpTimerRef.current = window.setTimeout(
        () => void externalOpen.cleanUp(),
        CLEAN_UP_DELAY_MS,
      )
    } catch (error) {
      if (attempt !== attemptRef.current) {
        return
      }

      if (error instanceof ExternalOpenError && error.code === 'NEEDS_GESTURE') {
        setState({ status: 'ready', resource, file })
      } else {
        setState(toErrorState(resource, error, true))
      }
    }
  }

  async function openExternally(resource: FileResource): Promise<void> {
    const attempt = ++attemptRef.current
    const isCurrent = () => attempt === attemptRef.current

    saveCopy.clearError()
    setState({ status: 'working', resource })

    // Straight from the click, before anything is awaited: the browser shows its
    // permission prompt only in response to one. (If access is already granted
    // this settles at once without asking.)
    const access = externalOpen.requestAccess()

    try {
      if (!(await access)) {
        if (isCurrent()) {
          setState({ status: 'denied', resource })
        }

        return
      }

      const content = await fileContent.load(resource.id)
      const file = await externalOpen.prepare(
        getFileResourceFileName(resource),
        content,
      )

      if (isCurrent()) {
        await handOver(resource, file, attempt)
      }
    } catch (error) {
      if (isCurrent()) {
        setState(toErrorState(resource, error, true))
      }
    }
  }

  /** Navigates this tab to `url`, saying so if it cannot. */
  async function navigate(resource: FileResource, url: string): Promise<void> {
    try {
      await tabs.open(url)
    } catch (error) {
      console.error(`Could not open file resource ${resource.id}`, error)
      setState({
        status: 'error',
        resource,
        message: `"${resource.name}" could not be opened. Try again.`,
        canRetry: true,
        inApp: false,
      })
    }
  }

  /**
   * Opens a PDF as the browser's own document. The extension's service worker
   * serves it, and a worker cannot ask for a file permission — only a page can,
   * and only from a click. So the file is checked here first, from the click:
   * `load` asks for access if it has lapsed (and finds a missing file), but
   * reads no bytes — a file handle's `getFile` is only a snapshot of the file.
   */
  async function openAsDocument(resource: FileResource): Promise<void> {
    saveCopy.clearError()
    setState({ status: 'idle' })

    try {
      await fileContent.load(resource.id)
    } catch (error) {
      setState(toErrorState(resource, error, false))

      return
    }

    await navigate(
      resource,
      buildFileDocumentUrl(resource.id, getFileResourceFileName(resource)),
    )
  }

  /**
   * Opens a file resource the default way — in the browser when it can be
   * shown there, otherwise in its application. Call it straight from a click.
   */
  function open(resource: FileResource): Promise<void> {
    switch (getViewerStrategy(resource.mimeType)) {
      case 'open-externally':
        return openExternally(resource)
      case 'native-pdf':
        return openAsDocument(resource)
      case 'render-markdown':
      case 'render-word':
      case 'render-spreadsheet':
      case 'render-presentation':
        return navigate(resource, buildFileViewerUrl(resource.id))
    }
  }

  /**
   * Opens a file resource in its desktop application, even when the browser
   * could show it — the "Open in Word/Excel/PowerPoint" choice. Call it straight
   * from a click.
   */
  function openInApp(resource: FileResource): Promise<void> {
    return openExternally(resource)
  }

  /** Saves a copy of a file resource the user can keep. Call it straight from a click. */
  function save(resource: FileResource): Promise<void> {
    setState({ status: 'idle' })

    return saveCopy.save(resource)
  }

  function dismissNotice(): void {
    setState({ status: 'idle' })
    saveCopy.clearError()
  }

  /** Does what the notice's button says. Call it straight from the button's click. */
  function runNoticeAction(): void {
    switch (state.status) {
      case 'ready':
        // One more click, which the browser honours.
        void handOver(state.resource, state.file, ++attemptRef.current)
        break
      case 'denied':
        // Only opening in an application asks for a permission.
        void openInApp(state.resource)
        break
      case 'error':
        if (state.canRetry) {
          void (state.inApp ? openInApp(state.resource) : open(state.resource))
        }
        break
      default:
        break
    }
  }

  /** What the dashboard should tell the user right now, if anything. */
  function describeNotice(): FileActionNotice | undefined {
    if (saveCopy.error) {
      return { tone: 'error', message: saveCopy.error }
    }

    switch (state.status) {
      case 'idle':
        return undefined
      case 'working':
        return { tone: 'info', message: `Opening "${state.resource.name}"…` }
      case 'opened': {
        // What was opened is a copy that is deleted afterwards, so changes saved
        // into it are lost. Only the application's own Save As keeps them (the
        // app's Save a copy saves the *original*, not what was edited), and the
        // user brings the saved file back by adding it: edits are not synced back.
        const appName = getResourceKind(state.resource.mimeType).appName

        return {
          tone: 'info',
          message: `Opened "${state.resource.name}". It's a temporary copy — to keep any changes, use Save As in ${appName ?? 'its app'}, then add the saved file to your collection.`,
        }
      }
      case 'ready':
        return {
          tone: 'info',
          message: `"${state.resource.name}" is ready.`,
          actionLabel: 'Open',
        }
      case 'denied':
        return {
          tone: 'error',
          message: `To open "${state.resource.name}" in its own app, Collections Launcher needs a permission from Chrome.`,
          actionLabel: 'Allow',
        }
      case 'error':
        return {
          tone: 'error',
          message: state.message,
          actionLabel: state.canRetry ? 'Try again' : undefined,
        }
    }
  }

  return {
    open,
    openInApp,
    save,
    notice: describeNotice(),
    runNoticeAction,
    dismissNotice,
  }
}