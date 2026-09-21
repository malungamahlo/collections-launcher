import { lazy, Suspense, useCallback, type RefObject } from 'react'
import { Button } from '@app/shared/components/ui/button'
import { Dialog } from '@app/shared/components/ui/dialog'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import type { OpenFileViewerState } from '../hooks/use-open-file-resource'
import { MARKDOWN_PREVIEW_MAX_BYTES } from '../model/markdown-preview'
import { getResourceKind } from '../model/resource-kind-registry'

// The Markdown renderer is the heaviest part of the viewer and most files
// opened are not Markdown, so it is loaded the first time one is shown rather
// than with every new tab.
const MarkdownView = lazy(() =>
  import('./markdown-view').then(module => ({ default: module.MarkdownView })),
)

interface FileViewerDialogProps {
  readonly state: OpenFileViewerState
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onRetry: () => void
  readonly onClose: () => void
}

const PDF_MIME_TYPE = 'application/pdf'

/** Room for the content: tall enough to read, never taller than the window. */
const CONTENT_HEIGHT_CLASS = 'h-[70vh]'

/**
 * Shows a PDF with the browser's own viewer, in a frame. The bytes reach the
 * frame through an object URL that lives exactly as long as the frame does: it
 * is made when the frame is attached and revoked when it is removed (the
 * cleanup a ref callback may return), so nothing is left behind and no copy is
 * written anywhere.
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

  return (
    <iframe
      ref={attachPdf}
      title={title}
      className={`${CONTENT_HEIGHT_CLASS} w-full rounded-lg border border-border bg-muted`}
    />
  )
}

/** The message shown in place of content, with an optional action. */
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
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border px-4 py-6">
      <p role={role} className="text-sm leading-6 text-card-foreground">
        {message}
      </p>

      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/**
 * The dialog that shows an opened file resource. It renders whichever state the
 * open-file hook is in — loading, a PDF, a Markdown document, a kind the
 * dashboard cannot show, or a read failure — and owns no logic of its own.
 */
export function FileViewerDialog({
  state,
  fallbackFocusRef,
  onRetry,
  onClose,
}: FileViewerDialogProps) {
  const { resource } = state
  const kind = getResourceKind(resource.mimeType)

  return (
    <Dialog
      title={resource.name}
      description={`${kind.label} · ${formatFileSize(resource.sizeBytes)}`}
      size="wide"
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      {state.status === 'loading' && <Notice message="Opening file…" />}

      {state.status === 'pdf' && (
        <PdfView blob={state.blob} title={resource.name} />
      )}

      {state.status === 'markdown' && (
        <div
          className={`scroll-slim ${CONTENT_HEIGHT_CLASS} overflow-y-auto rounded-lg border border-border px-5 py-4`}
        >
          {state.isTruncated && (
            <p
              role="status"
              className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
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
        </div>
      )}

      {state.status === 'unsupported' && (
        <Notice
          message={`${kind.label}s can't be previewed in the dashboard yet. Opening one in its desktop app would mean saving a second copy of the file, so it stays where it is.`}
        />
      )}

      {state.status === 'error' && (
        <Notice
          role="alert"
          message={state.message}
          action={
            state.code === 'NOT_FOUND'
              ? undefined
              : { label: 'Try again', onClick: onRetry }
          }
        />
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  )
}
