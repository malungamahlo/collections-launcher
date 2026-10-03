import { useCallback, type CSSProperties } from 'react'
import { PRESENTATION_MAX_SLIDES } from '../documents/document-limits'
import type {
  Frame,
  Paragraph,
  Presentation,
  Slide,
  SlideElement,
  TextBody,
  TextRun,
} from '../documents/presentation.types'

/** EMU per point. */
const EMU_PER_POINT = 12_700

/**
 * Shows a picture's bytes in an `<img>` through an object URL that lives
 * exactly as long as the element does: made when it is attached, released
 * when it is removed, so a deck's pictures are not held after the page.
 */
function useObjectUrlSource(blob: Blob): (image: HTMLImageElement | null) => (() => void) | undefined {
  return useCallback(
    (image: HTMLImageElement | null) => {
      if (!image) {
        return undefined
      }

      const objectUrl = URL.createObjectURL(blob)
      image.src = objectUrl

      return () => URL.revokeObjectURL(objectUrl)
    },
    [blob],
  )
}

/**
 * Sizes are given relative to the slide's width (`cqw`, the slide being a
 * size container), so a slide scales as one piece at any screen width.
 */
interface Scale {
  /** The slide size in EMU. */
  readonly width: number
  readonly height: number
}

function percent(value: number, of: number): string {
  return `${(value / of) * 100}%`
}

/** A length in EMU as a share of the slide's width. */
function emuWidth(value: number, scale: Scale): string {
  return `${(value / scale.width) * 100}cqw`
}

function pointSize(sizePt: number, scale: Scale): string {
  return emuWidth(sizePt * EMU_PER_POINT, scale)
}

function frameStyle(frame: Frame, scale: Scale): CSSProperties {
  return {
    position: 'absolute',
    left: percent(frame.x, scale.width),
    top: percent(frame.y, scale.height),
    width: percent(frame.width, scale.width),
    height: percent(frame.height, scale.height),
    ...(frame.rotation ? { transform: `rotate(${frame.rotation}deg)` } : {}),
  }
}

function runStyle(run: TextRun, scale: Scale): CSSProperties {
  return {
    fontSize: pointSize(run.sizePt, scale),
    fontWeight: run.bold ? 700 : 400,
    fontStyle: run.italic ? 'italic' : 'normal',
    textDecoration: run.underline ? 'underline' : 'none',
    ...(run.color ? { color: run.color } : {}),
    // The reader only lets through plain names (letters, digits, spaces, hyphens).
    ...(run.font ? { fontFamily: `"${run.font}", system-ui, sans-serif` } : {}),
  }
}

function TextRunView({ run, scale }: { readonly run: TextRun; readonly scale: Scale }) {
  const lines = run.text.split('\n')

  return (
    <span style={runStyle(run, scale)}>
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 && <br />}
          {line}
        </span>
      ))}
    </span>
  )
}

function ParagraphView({ paragraph, scale }: { readonly paragraph: Paragraph; readonly scale: Scale }) {
  const firstRun = paragraph.runs[0]
  const isEmpty = paragraph.runs.every(run => run.text === '')

  return (
    <p
      style={{
        textAlign: paragraph.align,
        margin: 0,
        lineHeight: 1.2,
        // Spaces are kept as PowerPoint keeps them: decks often indent text
        // with spaces to leave room for a picture placed beside it.
        whiteSpace: 'pre-wrap',
        paddingLeft: `${paragraph.level * 1.2 + (paragraph.bullet ? 1.1 : 0)}em`,
        textIndent: paragraph.bullet ? '-1.1em' : undefined,
        fontSize: pointSize(firstRun?.sizePt ?? paragraph.emptySizePt, scale),
        ...(isEmpty ? { minHeight: '1.2em' } : {}),
      }}
    >
      {paragraph.bullet && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '1.1em',
            textIndent: 0,
            ...(firstRun?.color ? { color: firstRun.color } : {}),
          }}
        >
          {paragraph.bullet}
        </span>
      )}
      {paragraph.runs.map((run, index) => (
        <TextRunView key={index} run={run} scale={scale} />
      ))}
    </p>
  )
}

const JUSTIFY: Readonly<Record<TextBody['anchor'], CSSProperties['justifyContent']>> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
}

function TextBodyView({ body, scale }: { readonly body: TextBody; readonly scale: Scale }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: JUSTIFY[body.anchor],
        height: '100%',
        boxSizing: 'border-box',
        paddingTop: emuWidth(body.insets.top, scale),
        paddingRight: emuWidth(body.insets.right, scale),
        paddingBottom: emuWidth(body.insets.bottom, scale),
        paddingLeft: emuWidth(body.insets.left, scale),
        overflowWrap: 'break-word',
      }}
    >
      {body.paragraphs.map((paragraph, index) => (
        <ParagraphView key={index} paragraph={paragraph} scale={scale} />
      ))}
    </div>
  )
}

function PictureView({ image, style }: { readonly image: Blob; readonly style: CSSProperties }) {
  const attach = useObjectUrlSource(image)

  return <img ref={attach} alt="" draggable={false} style={{ ...style, objectFit: 'fill' }} />
}

function ElementView({ element, scale }: { readonly element: SlideElement; readonly scale: Scale }) {
  const style = frameStyle(element.frame, scale)

  switch (element.kind) {
    case 'picture':
      return <PictureView image={element.image} style={style} />
    case 'table':
      return (
        <div style={style}>
          <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <tbody>
              {element.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        border: '1px solid #9ca3af',
                        padding: emuWidth(45_720, scale),
                        verticalAlign: 'top',
                        ...(cell.fill ? { background: cell.fill } : {}),
                      }}
                    >
                      {cell.paragraphs.map((paragraph, index) => (
                        <ParagraphView key={index} paragraph={paragraph} scale={scale} />
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'shape':
      return (
        <div
          style={{
            ...style,
            ...(element.fill ? { background: element.fill } : {}),
            ...(element.outline
              ? {
                  border: `max(1px, ${emuWidth(element.outline.width, scale)}) solid ${element.outline.color}`,
                  boxSizing: 'border-box',
                }
              : {}),
            borderRadius:
              element.geometry === 'ellipse'
                ? '50%'
                : element.geometry === 'rounded-rectangle'
                  ? // PowerPoint rounds a rounded rectangle by a sixth of its shorter side.
                    emuWidth(Math.min(element.frame.width, element.frame.height) / 6, scale)
                  : undefined,
            overflow: 'visible',
          }}
        >
          {element.text && <TextBodyView body={element.text} scale={scale} />}
        </div>
      )
  }
}

function ImageBackground({ image }: { readonly image: Blob }) {
  const attach = useObjectUrlSource(image)

  return (
    <img
      ref={attach}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

function SlideBackground({ slide }: { readonly slide: Slide }) {
  const { background } = slide

  return background.kind === 'color' ? (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: background.color }} />
  ) : (
    <ImageBackground image={background.image} />
  )
}

function SlideView({
  slide,
  scale,
  total,
}: {
  readonly slide: Slide
  readonly scale: Scale
  readonly total: number
}) {
  return (
    <section aria-label={`Slide ${slide.number} of ${total}`} className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-sm bg-white text-black shadow-[0_2px_10px_rgb(0_0_0_/_0.18)]"
        style={{
          aspectRatio: `${scale.width} / ${scale.height}`,
          containerType: 'inline-size',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <SlideBackground slide={slide} />
        {slide.elements.map((element, index) => (
          <ElementView key={index} element={element} scale={scale} />
        ))}
      </div>
    </section>
  )
}

/**
 * Draws a presentation slide after slide, the way a presentation program's
 * slide sorter or reading view does: each slide at its real proportions, its
 * text and pictures where the deck puts them. Read-only; animations,
 * transitions, charts and SmartArt are not drawn.
 */
export function PresentationView({ presentation }: { readonly presentation: Presentation }) {
  const scale: Scale = { width: presentation.width, height: presentation.height }

  return (
    <div className="min-h-full bg-slate-200 px-3 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {presentation.isTruncated && (
          <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            This presentation is long, so only the first {PRESENTATION_MAX_SLIDES} of its{' '}
            {presentation.totalSlides} slides are shown.
          </p>
        )}

        {presentation.slides.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">
            This presentation has no slides to show.
          </p>
        )}

        {presentation.slides.map(slide => (
          <SlideView key={slide.number} slide={slide} scale={scale} total={presentation.totalSlides} />
        ))}
      </div>
    </div>
  )
}
