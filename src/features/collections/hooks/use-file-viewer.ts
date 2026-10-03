import { useEffect, useState } from 'react'
import {
  FileContentError,
  type FileContentAdapter,
  type FileContentErrorCode,
} from '@app/platform/browser/file-content.adapter'
import type { ParseXml } from '../documents/office-package'
import type { Presentation } from '../documents/presentation.types'
import type { Workbook } from '../documents/spreadsheet.types'
import type { FileResource } from '../model/collection.types'
import { buildFileDocumentUrl } from '../model/file-document-location'
import { getFileResourceFileName } from '../model/file-name'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import {
  getResourceKind,
  getViewerStrategy,
  type ViewerStrategy,
} from '../model/resource-kind-registry'
import {
  describeCannotDisplay,
  describeFileReadFailure,
  type CannotDisplayReason,
} from './file-read-messages'

/**
 * What the viewer page is showing. A discriminated union rather than a bag of
 * flags, so each state carries exactly what its view needs and an impossible
 * combination (an error *and* content) cannot be represented.
 */
export type FileViewerState =
  /** The file is being read. */
  | { readonly status: 'loading' }
  /**
   * A PDF that can be read, on its way to its document address, where the
   * browser shows it as a document of its own. The page is about to be replaced.
   */
  | { readonly status: 'opening-document' }
  /**
   * A PDF shown in a frame on this page — only when its document address
   * could not serve it although this page can read it. A last resort: the
   * browser's own viewer still renders it, but under a made-up name.
   */
  | { readonly status: 'pdf'; readonly blob: Blob }
  /** A Word document's bytes, for the page to draw. */
  | { readonly status: 'word'; readonly blob: Blob }
  /** A workbook's sheets, read and ready to show. */
  | { readonly status: 'spreadsheet'; readonly workbook: Workbook }
  /** A presentation's slides, read and ready to draw. */
  | { readonly status: 'presentation'; readonly presentation: Presentation }
  /**
   * The file was read, but the browser cannot show it: too large to draw, or
   * not the kind of file its type says. Its application can.
   */
  | { readonly status: 'cannot-display'; readonly message: string }
  /** A Markdown file's text, ready to be rendered. */
  | {
      readonly status: 'markdown'
      readonly text: string
      /** True when the file was longer than `MARKDOWN_PREVIEW_MAX_BYTES`. */
      readonly isTruncated: boolean
    }
  /**
   * A kind that is shown in another application, not here (Word, Excel,
   * PowerPoint, …). The dashboard opens those without ever coming to this
   * page, so this is only reached by an address typed in by hand. Nothing is read.
   */
  | { readonly status: 'unsupported' }
  /** The file could not be read; `code` says why so the view can offer the right next step. */
  | {
      readonly status: 'error'
      readonly code: FileContentErrorCode
      readonly message: string
    }

interface UseFileViewerOptions {
  readonly fileContent: FileContentAdapter
  readonly resource: FileResource
  /**
   * Replaces this page with another address, leaving no history entry behind,
   * so Back from the document returns to wherever the user came from. Pass a
   * stable function: a new one reads the file again.
   */
  readonly replaceLocation: (url: string) => void
  /**
   * True when this page was reached because the PDF's document address could
   * not serve it. The page then does not send the tab straight back there on
   * its first read (which could loop) — only after the user presses Try again.
   */
  readonly documentUnavailable?: boolean
  /** Parses XML for the presentation reader; the browser's `DOMParser` by default. */
  readonly parseXml?: ParseXml
}

/**
 * The largest file of each drawn kind the page tries to show. Past this the
 * browser would take too long or too much memory to draw it; its application
 * is offered instead.
 */
export const BROWSER_VIEW_MAX_BYTES: Readonly<
  Record<'render-word' | 'render-spreadsheet' | 'render-presentation', number>
> = {
  'render-word': 30 * 1024 * 1024,
  'render-spreadsheet': 30 * 1024 * 1024,
  'render-presentation': 150 * 1024 * 1024,
}

const parseXmlWithDomParser: ParseXml = text =>
  new DOMParser().parseFromString(text, 'application/xml')

/** Thrown while reading a file for the page when it cannot be shown in the browser. */
class CannotDisplayError extends Error {
  constructor(readonly reason: CannotDisplayReason) {
    super(reason)
    this.name = 'CannotDisplayError'
  }
}

/**
 * Reads an Office file for the page. The readers are loaded only when needed —
 * they are large, and most files opened are not spreadsheets or decks.
 */
async function readOfficeFile(
  strategy: 'render-word' | 'render-spreadsheet' | 'render-presentation',
  blob: Blob,
  parseXml: ParseXml,
): Promise<FileViewerState> {
  if (blob.size > BROWSER_VIEW_MAX_BYTES[strategy]) {
    throw new CannotDisplayError('too-large')
  }

  try {
    switch (strategy) {
      case 'render-word': {
        // The page draws it, but check it is a Word document first, so a
        // damaged file gets the same message a damaged workbook or deck does.
        const { default: JSZip } = await import('jszip')
        const zip = await JSZip.loadAsync(await blob.arrayBuffer())

        if (!zip.file('word/document.xml')) {
          throw new Error('Not a Word document.')
        }

        return { status: 'word', blob }
      }
      case 'render-spreadsheet': {
        const { readWorkbook } = await import('../documents/spreadsheet-reader')

        return { status: 'spreadsheet', workbook: readWorkbook(await blob.arrayBuffer()) }
      }
      case 'render-presentation': {
        const { readPresentation } = await import('../documents/presentation-reader')

        return {
          status: 'presentation',
          presentation: await readPresentation(await blob.arrayBuffer(), { parseXml }),
        }
      }
    }
  } catch (error) {
    const isTooLarge = error instanceof Error && /too large/i.test(error.message)

    throw new CannotDisplayError(isTooLarge ? 'too-large' : 'unreadable')
  }
}

function isOfficeStrategy(
  strategy: ViewerStrategy,
): strategy is 'render-word' | 'render-spreadsheet' | 'render-presentation' {
  return (
    strategy === 'render-word' ||
    strategy === 'render-spreadsheet' ||
    strategy === 'render-presentation'
  )
}

/** Turns loaded bytes into a Markdown state. */
async function readMarkdown(blob: Blob): Promise<FileViewerState> {
  const isTruncated = blob.size > MARKDOWN_PREVIEW_MAX_BYTES
  const text = await (isTruncated
    ? blob.slice(0, MARKDOWN_PREVIEW_MAX_BYTES)
    : blob
  ).text()

  return { status: 'markdown', text, isTruncated }
}

/**
 * Reads a file resource for the viewer page and exposes what to display. The
 * resource's MIME type is looked up in the registry to pick how it is shown,
 * so no format is named here — a PDF and a Markdown file differ only in what
 * the viewer strategy says.
 *
 * A Markdown file is rendered here, and so is an Office file the browser can
 * draw: a Word document's pages, a workbook's sheets, a presentation's
 * slides — read on this machine by the extension's own readers, never
 * uploaded. One too large to draw, or not what its type says, gets
 * `cannot-display` and a pointer to its application. A PDF is not shown
 * here: once it is known to be
 * readable — which, after a browser restart, may first need the user to grant
 * access again with **Try again** — the page is replaced by its document
 * address, where the browser shows it as a document of its own.
 *
 * The file is read where it lives; nothing is ever written. It is read once
 * per resource, and again on `retry()`. A read that finishes after the page
 * has moved on is discarded.
 */
export function useFileViewer({
  fileContent,
  resource,
  replaceLocation,
  documentUnavailable = false,
  parseXml = parseXmlWithDomParser,
}: UseFileViewerOptions): {
  readonly state: FileViewerState
  readonly retry: () => void
} {
  // Primitives, so a change elsewhere in the collections (which hands back a
  // new resource object with the same content) does not read the file again.
  const { id, name, mimeType } = resource
  const documentUrl = buildFileDocumentUrl(id, getFileResourceFileName(resource))
  const strategy = getViewerStrategy(mimeType)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<FileViewerState>(
    strategy === 'open-externally' ? { status: 'unsupported' } : { status: 'loading' },
  )

  useEffect(() => {
    if (strategy === 'open-externally') {
      return
    }

    let isCurrent = true

    void fileContent
      .load(id)
      .then(blob => {
        if (!isCurrent) {
          return
        }

        if (strategy === 'render-markdown' || isOfficeStrategy(strategy)) {
          return (
            strategy === 'render-markdown'
              ? readMarkdown(blob)
              : readOfficeFile(strategy, blob, parseXml)
          ).then(next => {
            if (isCurrent) {
              setState(next)
            }
          })
        }

        // A PDF goes to its document address — unless that address just sent
        // the tab here and the user has not asked to try again.
        if (documentUnavailable && attempt === 0) {
          setState({ status: 'pdf', blob })
        } else {
          setState({ status: 'opening-document' })
          replaceLocation(documentUrl)
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return
        }

        if (error instanceof CannotDisplayError) {
          setState({
            status: 'cannot-display',
            message: describeCannotDisplay(name, error.reason, getResourceKind(mimeType).appName),
          })

          return
        }

        const code: FileContentErrorCode =
          error instanceof FileContentError ? error.code : 'UNAVAILABLE'

        if (!(error instanceof FileContentError)) {
          console.error(`Could not open file resource ${id}`, error)
        }

        setState({
          status: 'error',
          code,
          message: describeFileReadFailure(name, code),
        })
      })

    return () => {
      isCurrent = false
    }
  }, [
    fileContent,
    id,
    name,
    strategy,
    attempt,
    documentUrl,
    documentUnavailable,
    replaceLocation,
    parseXml,
    mimeType,
  ])

  /** Reads the file again — from a click, so a lapsed permission can be re-granted. */
  function retry(): void {
    setState({ status: 'loading' })
    setAttempt(previous => previous + 1)
  }

  return { state, retry }
}
