import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import { cn } from '@app/shared/lib/utils'
import { describeCannotDisplay } from '../hooks/file-read-messages'
import type { FileViewerState } from '../hooks/use-file-viewer'
import type { FileResource } from '../model/collection.types'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { getResourceKind } from '../model/resource-kind-registry'

// The Markdown renderer is the heaviest part of the viewer and most files
// opened are not Markdown, so it is loaded the first time one is shown.
const MarkdownView = lazy(() =>
  import('./markdown-view').then(module => ({ default: module.MarkdownView })),
)
// The same goes for each Office view: each is loaded only when a file of its kind is shown.
const WordView = lazy(() =>
  import('./word-view').then(module => ({ default: module.WordView })),
)
const SpreadsheetView = lazy(() =>
  import('./spreadsheet-view').then(module => ({ default: module.SpreadsheetView })),
)
const PresentationView = lazy(() =>
  import('./presentation-view').then(module => ({ default: module.PresentationView })),
)

/** What shows while a view's code is still loading. */
function Loading() {
  return (
    <p role="status" className="p-6 text-sm text-muted-foreground">
      Opening file…
    </p>
  )
}

interface FileViewerProps {
  readonly resource: FileResource
  readonly state: FileViewerState
  readonly onRetry: () => void
}

const PDF_MIME_TYPE = 'application/pdf'

/**
 * Shows a PDF with the browser's own viewer, in a frame that fills the page —
 * only as a last resort, when its document address could not serve it (see
 * `FileViewerState`). Normally a PDF never appears on this page at all.
 * The bytes reach the frame through an object URL that lives exactly as long
 * as the frame does: it is made when the frame is attached and revoked when it
 * is removed (the cleanup a ref callback may return), so nothing is left
 * behind and no copy is written anywhere.
 *
 * The blob is re-typed as a PDF rather than trusting whatever type the file
 * carried, so the frame can only ever be given a PDF to render — never an HTML
 * document that would run in the extension's origin.
 */
function PdfView({ blob, title }: { readonly blob: Blob; readonly title: string }) {
  const attachPdf = useCallback(
    (frame: HTMLIFrameElement | null) => {
      if (!frame) {
        return undefined
      }

      const objectUrl = URL.createObjectURL(
        new Blob([blob], { type: PDF_MIME_TYPE }),
      )
      frame.src = objectUrl

      return () => {
        URL.revokeObjectURL(objectUrl)
      }
    },
    [blob],
  )

  return <iframe ref={attachPdf} title={title} className="size-full border-0" />
}

/** A message in the middle of the page, with an optional action. */
function Notice({
  message,
  role = 'status',
  action,
}: {
  readonly message: string
  readonly role?: 'status' | 'alert'
  readonly action?: { readonly label: string; readonly onClick: () => void }
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-6">
        <p role={role} className="text-sm leading-6 text-card-foreground">
          {message}
        </p>

        {action && (
          <Button variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * The page a file resource is viewed on: the document itself — a rendered
 * Markdown file, a Word document's pages, a workbook's sheets, a deck's
 * slides — or a message. It renders the state the viewer hook is in and owns
 * no logic of its own.
 *
 * **Nothing of the app's own surrounds the document**: no header, no kind or
 * size, no Save a copy or Open in app button. The tab title already names the
 * file (`useDocumentTitle`, set by the caller), and the file's row on the
 * dashboard has the "Open with…" menu, so the page holds the document and nothing
 * else — the way a file opened straight from disk does. A PDF does not stay on
 * this page at all; it goes on to be the browser's own document.
 */
export function FileViewer({ resource, state, onRetry }: FileViewerProps) {
  // A Word document is checked before it reaches the page, but is only drawn
  // here; if drawing it fails after all, say so the same way.
  const [wordFailed, setWordFailed] = useState(false)
  const handleWordError = useCallback(() => setWordFailed(true), [])
  const cannotDisplay = (reason: 'unreadable') =>
    describeCannotDisplay(resource.name, reason, getResourceKind(resource.mimeType).appName)
  let body: ReactNode

  switch (state.status) {
    case 'loading':
    case 'opening-document':
      body = <Notice message="Opening file…" />
      break
    case 'pdf':
      body = <PdfView blob={state.blob} title={resource.name} />
      break
    case 'markdown':
      body = (
        <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          {state.isTruncated && (
            <p
              role="status"
              className="mb-6 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              This document is large, so only the first{' '}
              {formatFileSize(MARKDOWN_PREVIEW_MAX_BYTES)} is shown.
            </p>
          )}

          <Suspense
            fallback={
              <p role="status" className="text-sm text-muted-foreground">
                Opening file…
              </p>
            }
          >
            <MarkdownView text={state.text} />
          </Suspense>
        </article>
      )
      break
    case 'word':
      body = wordFailed ? (
        <Notice message={cannotDisplay('unreadable')} />
      ) : (
        <Suspense fallback={<Loading />}>
          <WordView blob={state.blob} onError={handleWordError} />
        </Suspense>
      )
      break
    case 'spreadsheet':
      body = (
        <Suspense fallback={<Loading />}>
          <SpreadsheetView workbook={state.workbook} />
        </Suspense>
      )
      break
    case 'presentation':
      body = (
        <Suspense fallback={<Loading />}>
          <PresentationView presentation={state.presentation} />
        </Suspense>
      )
      break
    case 'cannot-display':
      body = <Notice message={state.message} />
      break
    case 'unsupported':
      body = (
        <Notice
          message={`"${resource.name}" opens in its own app. Open it from your collections.`}
        />
      )
      break
    case 'error':
      body = (
        <Notice
          role="alert"
          message={state.message}
          action={
            state.code === 'NOT_FOUND'
              ? undefined
              : { label: 'Try again', onClick: onRetry }
          }
        />
      )
      break
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <main
        className={cn(
          'min-h-0 flex-1',
          // A PDF frame and a spreadsheet's grid scroll inside themselves.
          state.status === 'pdf' || state.status === 'spreadsheet'
            ? 'overflow-hidden'
            : 'overflow-y-auto',
        )}
      >
        {body}
      </main>
    </div>
  )
}
