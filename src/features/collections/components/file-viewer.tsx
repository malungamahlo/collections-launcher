import { Download } from 'lucide-react'
import { lazy, Suspense, useCallback, type ReactNode } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import { cn } from '@app/shared/lib/utils'
import type { FileViewerState } from '../hooks/use-file-viewer'
import type { FileResource } from '../model/collection.types'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { getResourceKind } from '../model/resource-kind-registry'
import { RESOURCE_ICONS } from './resource-icons'

// The Markdown renderer is the heaviest part of the viewer and most files
// opened are not Markdown, so it is loaded the first time one is shown.
const MarkdownView = lazy(() =>
  import('./markdown-view').then(module => ({ default: module.MarkdownView })),
)

interface FileViewerProps {
  readonly resource: FileResource
  readonly state: FileViewerState
  /** Why saving a copy failed, if it did; shown under the header. */
  readonly saveError?: string
  readonly onRetry: () => void
  readonly onSave: () => void
}

const PDF_MIME_TYPE = 'application/pdf'

/**
 * Shows a PDF with the browser's own viewer, in a frame that fills the page.
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
 * The page a file resource is viewed on: a header with its name, kind and
 * size, above whatever its state calls for — a PDF, a rendered Markdown
 * document, or a message. It renders the state the viewer hook is in and owns
 * no logic of its own.
 *
 * The header's **Save a copy** button is left out entirely for a PDF: once
 * shown, a PDF is rendered by the browser's own built-in viewer, which
 * already has its own download control in its toolbar — a second one next to
 * it would just be the same action twice. It stays for every other kind
 * (Markdown's renderer is this app's own and has no native save affordance of
 * its own), and it is decided by the resource's *kind*, not by which state the
 * page happens to be in, so it does not appear and disappear as the page goes
 * from loading to showing content.
 */
export function FileViewer({
  resource,
  state,
  saveError,
  onRetry,
  onSave,
}: FileViewerProps) {
  const kind = getResourceKind(resource.mimeType)
  const KindIcon = RESOURCE_ICONS[kind.iconKey]
  const offersSaveCopy = kind.viewer !== 'native-pdf'

  let body: ReactNode

  switch (state.status) {
    case 'loading':
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
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <KindIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-card-foreground sm:text-lg">
            {resource.name}
          </h1>
          <p className="truncate text-xs text-muted-foreground sm:text-sm">
            {kind.label} · {formatFileSize(resource.sizeBytes)}
          </p>
        </div>

        {offersSaveCopy && (
          <Button
            variant="secondary"
            className="shrink-0 gap-2"
            aria-label="Save a copy"
            title="Save a copy"
            onClick={onSave}
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Save a copy</span>
          </Button>
        )}
      </header>

      {offersSaveCopy && saveError && (
        <p
          role="alert"
          className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-6"
        >
          {saveError}
        </p>
      )}

      <main
        className={cn(
          'min-h-0 flex-1',
          state.status === 'pdf' ? 'overflow-hidden' : 'overflow-y-auto',
        )}
      >
        {body}
      </main>
    </div>
  )
}
