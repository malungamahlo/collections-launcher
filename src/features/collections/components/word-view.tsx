import { renderAsync, type Options } from 'docx-preview'
import { useEffect, useRef } from 'react'
import { secureRenderedDocument } from '../documents/secure-rendered-document'

/**
 * How `docx-preview` is asked to draw a document. Embedded HTML ("alt
 * chunks") is never drawn — it would be a web page inside the document — and
 * pictures become object URLs, not inline data.
 */
const RENDER_OPTIONS: Partial<Options> = {
  className: 'docx',
  inWrapper: true,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  renderComments: false,
  renderAltChunks: false,
  experimental: false,
  useBase64URL: false,
}

/**
 * The page around the document's pages: a neutral grey, as a word processor
 * shows it. `:host` makes these rules outrank the renderer's own, which are
 * added after them.
 */
const WRAPPER_STYLE = `
  :host { display: block; background: #e5e7eb; }
  :host .docx-wrapper { background: #e5e7eb; padding: 24px 12px; }
  :host .docx-wrapper > section.docx { box-shadow: 0 1px 6px rgb(0 0 0 / 0.18); margin-bottom: 24px; }
`

/** The grey kept on each side of a page, in CSS pixels (the wrapper's side padding). */
const PAGE_GUTTER = 12

/**
 * Shrinks the drawn pages to fit the width they have, the way a phone's word
 * processor does, so a page never runs off the side of a narrow screen. A
 * page is never made larger than its real size. Returns a function that stops
 * following the width.
 */
function fitPagesToWidth(host: HTMLElement, body: HTMLElement): () => void {
  const pageWidth = Math.max(
    0,
    ...Array.from(body.querySelectorAll<HTMLElement>('section.docx'), page => page.offsetWidth),
  )

  if (pageWidth === 0) {
    return () => undefined
  }

  const fit = () => {
    const available = host.clientWidth - PAGE_GUTTER * 2
    body.style.zoom = String(available > 0 ? Math.min(1, available / pageWidth) : 1)
  }

  fit()

  if (typeof ResizeObserver === 'undefined') {
    return () => undefined
  }

  const observer = new ResizeObserver(fit)
  observer.observe(host)

  return () => observer.disconnect()
}

interface WordViewProps {
  readonly blob: Blob
  /** Called when the document could not be drawn after all. */
  readonly onError: () => void
}

/**
 * Draws a Word document as pages, the way a word processor shows it. The
 * document goes into a shadow root so its own styles and the app's never
 * touch each other: the app's CSS reset would otherwise flatten its lists and
 * headings, and the document's styles could restyle the app.
 */
export function WordView({ blob, onError }: WordViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current

    if (!host) {
      return
    }

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const frameStyle = document.createElement('style')
    const documentStyles = document.createElement('div')
    const body = document.createElement('div')
    frameStyle.textContent = WRAPPER_STYLE
    shadow.replaceChildren(frameStyle, documentStyles, body)

    let isCurrent = true
    let stopFitting: (() => void) | undefined

    void renderAsync(blob, body, documentStyles, RENDER_OPTIONS)
      .then(() => {
        if (isCurrent) {
          secureRenderedDocument(body)
          stopFitting = fitPagesToWidth(host, body)
        }
      })
      .catch(() => {
        if (isCurrent) {
          onError()
        }
      })

    return () => {
      isCurrent = false
      stopFitting?.()
      shadow.replaceChildren()
    }
  }, [blob, onError])

  return <div ref={hostRef} className="min-h-full" data-testid="word-document" />
}
