import { useRef, useState } from 'react'
import {
  FileContentError,
  type FileContentAdapter,
  type FileContentErrorCode,
} from '@app/platform/browser/file-content.adapter'
import type { FileResource } from '../model/collection.types'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { getViewerStrategy } from '../model/resource-kind-registry'

/**
 * What the file viewer is showing. A discriminated union rather than a bag of
 * flags, so each state carries exactly what its view needs and an impossible
 * combination (an error *and* content) cannot be represented.
 */
export type FileViewerState =
  | { readonly status: 'closed' }
  /** The file is being read. */
  | { readonly status: 'loading'; readonly resource: FileResource }
  /** A PDF, ready to be shown by the browser's own viewer. */
  | {
      readonly status: 'pdf'
      readonly resource: FileResource
      readonly blob: Blob
    }
  /** A Markdown file's text, ready to be rendered. */
  | {
      readonly status: 'markdown'
      readonly resource: FileResource
      readonly text: string
      /** True when the file was longer than `MARKDOWN_PREVIEW_MAX_BYTES`. */
      readonly isTruncated: boolean
    }
  /**
   * A kind the dashboard cannot show itself (Word, Excel, PowerPoint, …).
   * Nothing is read or written: handing such a file to its desktop app would
   * mean saving a second copy of it, which this app does not do.
   */
  | { readonly status: 'unsupported'; readonly resource: FileResource }
  /** The file could not be read; `code` says why so the view can offer the right next step. */
  | {
      readonly status: 'error'
      readonly resource: FileResource
      readonly code: FileContentErrorCode
      readonly message: string
    }

/** A viewer state that has a resource to show — everything except `closed`. */
export type OpenFileViewerState = Exclude<FileViewerState, { status: 'closed' }>

interface UseOpenFileResourceOptions {
  readonly fileContent: FileContentAdapter
}

/** The message shown to the user for a failure to read a file. */
function describeReadFailure(
  resource: FileResource,
  code: FileContentErrorCode,
): string {
  switch (code) {
    case 'NOT_FOUND':
      return `"${resource.name}" could not be found. It may have been moved, renamed, or deleted.`
    case 'PERMISSION_DENIED':
      return `Access to "${resource.name}" was not granted. Choose Try again and allow access when the browser asks.`
    case 'UNAVAILABLE':
      return `"${resource.name}" could not be opened. Try again.`
  }
}

/**
 * Coordinates opening a file resource from its row: reading its content and
 * exposing what the viewer should display. The resource's MIME type is looked
 * up in the registry to pick how it is shown, so no format is named here —
 * a PDF and a Markdown file differ only in what the viewer strategy says.
 * Websites never come through here; they open as tabs.
 *
 * Opening reads the file where it lives — it never writes a copy — and
 * only one file is open at a time. A read that finishes after the viewer was
 * closed, or after another file was opened, is discarded.
 */
export function useOpenFileResource({ fileContent }: UseOpenFileResourceOptions) {
  const [state, setState] = useState<FileViewerState>({ status: 'closed' })
  // Identifies the most recent open (or close). Every await below checks it,
  // so a slow read cannot land on a viewer the user has moved on from.
  const requestIdRef = useRef(0)
  const currentResourceRef = useRef<FileResource>(undefined)

  /**
   * Opens `resource` in the viewer. Must be called from a click (or other user
   * gesture): a file whose read permission has lapsed can only be re-granted
   * through a browser prompt, and the browser only shows one for a gesture.
   */
  async function open(resource: FileResource): Promise<void> {
    const requestId = ++requestIdRef.current
    currentResourceRef.current = resource

    const strategy = getViewerStrategy(resource.mimeType)

    if (strategy === 'open-externally') {
      setState({ status: 'unsupported', resource })
      return
    }

    setState({ status: 'loading', resource })

    try {
      const blob = await fileContent.load(resource.id)
      const nextState = await buildViewState(resource, strategy, blob)

      if (requestId === requestIdRef.current) {
        setState(nextState)
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      const code: FileContentErrorCode =
        error instanceof FileContentError ? error.code : 'UNAVAILABLE'

      if (!(error instanceof FileContentError)) {
        console.error(`Could not open file resource ${resource.id}`, error)
      }

      setState({
        status: 'error',
        resource,
        code,
        message: describeReadFailure(resource, code),
      })
    }
  }

  /** Tries the file again — a new gesture, so a lapsed permission can be re-granted. */
  function retry(): void {
    const resource = currentResourceRef.current

    if (resource) {
      void open(resource)
    }
  }

  /** Closes the viewer and abandons any read still in flight. */
  function close(): void {
    requestIdRef.current += 1
    currentResourceRef.current = undefined
    setState({ status: 'closed' })
  }

  return { state, open, retry, close }
}

/** Turns loaded bytes into the viewer state for the resource's strategy. */
async function buildViewState(
  resource: FileResource,
  strategy: 'native-pdf' | 'render-markdown',
  blob: Blob,
): Promise<FileViewerState> {
  if (strategy === 'native-pdf') {
    return { status: 'pdf', resource, blob }
  }

  const isTruncated = blob.size > MARKDOWN_PREVIEW_MAX_BYTES
  const text = await (isTruncated
    ? blob.slice(0, MARKDOWN_PREVIEW_MAX_BYTES)
    : blob
  ).text()

  return { status: 'markdown', resource, text, isTruncated }
}
