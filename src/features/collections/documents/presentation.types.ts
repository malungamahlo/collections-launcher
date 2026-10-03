/**
 * A presentation as this app draws it: each slide's text boxes, pictures and
 * simple tables at their real positions, over the slide's background. A plain
 * data shape built by the reader — no XML, no zip, nothing from the file that
 * could run — so the view only ever places boxes.
 *
 * Positions and sizes are in EMU (English Metric Units, 914,400 per inch), the
 * unit the file itself uses; the view turns them into fractions of the slide.
 * Colours are always `#rrggbb`. Things the reader does not draw (charts,
 * SmartArt, video, animations, arbitrary shape outlines) are left out.
 */
export interface Presentation {
  /** The slide size, in EMU. */
  readonly width: number
  readonly height: number
  readonly slides: readonly Slide[]
  /** How many slides the file has, shown or not. */
  readonly totalSlides: number
  /** True when only the first slides are shown (see the reader's limits). */
  readonly isTruncated: boolean
}

export interface Slide {
  /** 1-based, as PowerPoint numbers it. */
  readonly number: number
  readonly background: SlideFill
  /** In drawing order: later elements are drawn over earlier ones. */
  readonly elements: readonly SlideElement[]
}

export type SlideFill =
  | { readonly kind: 'color'; readonly color: string }
  | { readonly kind: 'image'; readonly image: Blob }

/** Where an element sits on the slide, in EMU, and how far it is turned (degrees). */
export interface Frame {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly rotation: number
}

export type ShapeGeometry = 'rectangle' | 'ellipse' | 'rounded-rectangle'

export type SlideElement =
  | {
      readonly kind: 'shape'
      readonly frame: Frame
      readonly geometry: ShapeGeometry
      readonly fill?: string
      readonly outline?: { readonly color: string; readonly width: number }
      readonly text?: TextBody
    }
  | { readonly kind: 'picture'; readonly frame: Frame; readonly image: Blob }
  | {
      readonly kind: 'table'
      readonly frame: Frame
      readonly rows: readonly (readonly TableCell[])[]
    }

export interface TableCell {
  readonly paragraphs: readonly Paragraph[]
  readonly fill?: string
}

export interface TextBody {
  readonly paragraphs: readonly Paragraph[]
  readonly anchor: 'top' | 'middle' | 'bottom'
  /** Space between the box's edge and its text, in EMU. */
  readonly insets: {
    readonly top: number
    readonly right: number
    readonly bottom: number
    readonly left: number
  }
}

export interface Paragraph {
  readonly runs: readonly TextRun[]
  /** 0 for top-level text, 1 for the first indent, and so on. */
  readonly level: number
  readonly align: 'left' | 'center' | 'right' | 'justify'
  /** The bullet shown before it ("•", "1."), if any. */
  readonly bullet?: string
  /** The size of an empty line, in points, so blank paragraphs keep their height. */
  readonly emptySizePt: number
}

export interface TextRun {
  /** May contain `\n` for a line break within the paragraph. */
  readonly text: string
  readonly sizePt: number
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly color?: string
  /** A plain font family name, already checked to be safe to put in CSS. */
  readonly font?: string
}
