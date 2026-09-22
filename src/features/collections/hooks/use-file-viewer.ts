import { useEffect, useState } from 'react'
import {
  FileContentError,
  type FileContentAdapter,
  type FileContentErrorCode,
} from '@app/platform/browser/file-content.adapter'
import type { FileResource } from '../model/collection.types'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { getViewerStrategy } from '../model/resource-kind-registry'
import { describeFileReadFailure } from './file-read-messages'

/**
 * What the viewer page is showing. A discriminated union rather than a bag of
 * flags, so each state carries exactly what its view needs and an impossible
 * combination (an error *and* content) cannot be represented.
 */
export type FileViewerState =
  /** The file is being read. */
  | { readonly status: 'loading' }
  /** A PDF, ready to be shown by the browser's own viewer. */
  | { readonly status: 'pdf'; readonly blob: Blob }
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
}

/** Turns loaded bytes into the state for the resource's viewer strategy. */
async function readForViewer(
  strategy: 'native-pdf' | 'render-markdown',
  blob: Blob,
): Promise<FileViewerState> {
  if (strategy === 'native-pdf') {
    return { status: 'pdf', blob }
  }

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
 * The file is read where it lives; nothing is ever written. It is read once
 * per resource, and again on `retry()`. A read that finishes after the page
 * has moved on is discarded.
 */
export function useFileViewer({ fileContent, resource }: UseFileViewerOptions): {
  readonly state: FileViewerState
  readonly retry: () => void
} {
  // Primitives, so a change elsewhere in the collections (which hands back a
  // new resource object with the same content) does not read the file again.
  const { id, name, mimeType } = resource
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
      .then(blob => readForViewer(strategy, blob))
      .then(next => {
        if (isCurrent) {
          setState(next)
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
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
  }, [fileContent, id, name, strategy, attempt])

  /** Reads the file again — from a click, so a lapsed permission can be re-granted. */
  function retry(): void {
    setState({ status: 'loading' })
    setAttempt(previous => previous + 1)
  }

  return { state, retry }
}
