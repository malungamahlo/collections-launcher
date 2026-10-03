import { PRESENTATION_MAX_SLIDES } from './document-limits'
import {
  readColor,
  readColorMap,
  readFill,
  readThemeColors,
  type ColorContext,
} from './drawing-color'
import {
  boolAttribute,
  child,
  childAt,
  children,
  descendants,
  intAttribute,
  isRelationshipOf,
  NS,
  OfficePackage,
  OfficePackageError,
  type ParseXml,
  type Relationship,
} from './office-package'
import type {
  Frame,
  Paragraph,
  Presentation,
  ShapeGeometry,
  Slide,
  SlideElement,
  SlideFill,
  TableCell,
  TextBody,
  TextRun,
} from './presentation.types'

/**
 * Reads a PowerPoint presentation (`.pptx`) into slides of positioned text
 * boxes, pictures and simple tables (see `Presentation`). This is not a full
 * renderer — charts, SmartArt, video and shape effects are not drawn — but it
 * follows PowerPoint's inheritance (slide → layout → master → theme) for where
 * placeholders sit and how their text looks, so a typical deck reads as it was
 * written. The file is untrusted: see `OfficePackage` for its size limits, and
 * nothing from it reaches the view except numbers, `#rrggbb` colours, checked
 * font names, text, and picture bytes.
 */


/** PowerPoint's default slide size (16:9), for a file that does not give one. */
const DEFAULT_SLIDE_SIZE = { width: 12_192_000, height: 6_858_000 }
/** PowerPoint's default text size, when nothing in the inheritance chain sets one. */
const DEFAULT_TEXT_SIZE_PT = 18
/** EMU per point. */
const EMU_PER_POINT = 12_700
/** The default space between a text box's edge and its text. */
const DEFAULT_INSETS = { top: 45_720, right: 91_440, bottom: 45_720, left: 91_440 }

/** The picture formats a browser can show, by extension. Others (EMF, WMF, TIFF) are left out. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

/** A font family name safe to put in CSS: letters, digits, spaces and hyphens only. */
const SAFE_FONT = /^[\p{L}\p{N} -]{1,64}$/u

interface Part {
  readonly path: string
  readonly document: Document
  readonly relationships: ReadonlyMap<string, Relationship>
}

interface Master extends Part {
  readonly colors: ColorContext
  readonly fonts: { readonly major?: string; readonly minor?: string }
  readonly textStyles: {
    readonly title?: Element
    readonly body?: Element
    readonly other?: Element
  }
}

interface Layout extends Part {
  readonly master: Master
}

interface Placeholder {
  readonly type: string
  readonly index?: string
}

type TextCategory = 'title' | 'body' | 'other'

/** Maps an element's frame from a group's child coordinates onto the slide. */
type Transform = (frame: Frame) => Frame

const IDENTITY: Transform = frame => frame

// --- Parts -------------------------------------------------------------------

async function readPart(pkg: OfficePackage, path: string): Promise<Part | undefined> {
  const document = await pkg.xml(path)

  return document
    ? { path, document, relationships: await pkg.relationships(path) }
    : undefined
}

function relatedPath(part: Part, kind: string): string | undefined {
  for (const relationship of part.relationships.values()) {
    if (isRelationshipOf(relationship, kind)) {
      return relationship.path
    }
  }

  return undefined
}

function safeFont(name: string | null | undefined): string | undefined {
  return name && SAFE_FONT.test(name) ? name : undefined
}

async function readMaster(pkg: OfficePackage, path: string): Promise<Master | undefined> {
  const part = await readPart(pkg, path)

  if (!part) {
    return undefined
  }

  const themePath = relatedPath(part, 'theme')
  const theme = themePath ? await pkg.xml(themePath) : undefined
  const fontScheme = theme?.getElementsByTagNameNS(NS.a, 'fontScheme')[0]
  const root = part.document.documentElement
  const textStyles = child(root, NS.p, 'txStyles')

  return {
    ...part,
    colors: {
      scheme: readThemeColors(theme),
      map: readColorMap(child(root, NS.p, 'clrMap')),
    },
    fonts: {
      major: safeFont(childAt(fontScheme, [NS.a, 'majorFont'], [NS.a, 'latin'])?.getAttribute('typeface')),
      minor: safeFont(childAt(fontScheme, [NS.a, 'minorFont'], [NS.a, 'latin'])?.getAttribute('typeface')),
    },
    textStyles: {
      title: child(textStyles, NS.p, 'titleStyle'),
      body: child(textStyles, NS.p, 'bodyStyle'),
      other: child(textStyles, NS.p, 'otherStyle'),
    },
  }
}

/** Reads layouts and masters once each, however many slides share them. */
class PartCache {
  private readonly layouts = new Map<string, Promise<Layout | undefined>>()
  private readonly masters = new Map<string, Promise<Master | undefined>>()

  constructor(private readonly pkg: OfficePackage) {}

  layout(path: string): Promise<Layout | undefined> {
    let layout = this.layouts.get(path)

    if (!layout) {
      layout = (async () => {
        const part = await readPart(this.pkg, path)
        const masterPath = part ? relatedPath(part, 'slideMaster') : undefined
        const master = masterPath ? await this.master(masterPath) : undefined

        return part && master ? { ...part, master } : undefined
      })()
      this.layouts.set(path, layout)
    }

    return layout
  }

  master(path: string): Promise<Master | undefined> {
    let master = this.masters.get(path)

    if (!master) {
      master = readMaster(this.pkg, path)
      this.masters.set(path, master)
    }

    return master
  }
}

// --- Shapes and placeholders ---------------------------------------------------

/** The non-visual properties element of any kind of shape (`nvSpPr`, `nvPicPr`, …). */
function nonVisual(shape: Element): Element | undefined {
  return children(shape, NS.p).find(element => element.localName.startsWith('nv'))
}

function readPlaceholder(shape: Element): Placeholder | undefined {
  const ph = childAt(nonVisual(shape), [NS.p, 'nvPr'], [NS.p, 'ph'])

  if (!ph) {
    return undefined
  }

  const index = ph.getAttribute('idx')

  return {
    type: ph.getAttribute('type') || 'obj',
    ...(index ? { index } : {}),
  }
}

function categoryOf(placeholder: Placeholder | undefined): TextCategory {
  if (!placeholder) {
    return 'other'
  }

  if (placeholder.type === 'title' || placeholder.type === 'ctrTitle') {
    return 'title'
  }

  return ['dt', 'ftr', 'sldNum', 'hdr'].includes(placeholder.type) ? 'other' : 'body'
}

/** The general type a master uses for a placeholder type (a master has no `ctrTitle` or `subTitle`). */
function masterType(type: string): string {
  if (type === 'ctrTitle') {
    return 'title'
  }

  return type === 'subTitle' || type === 'obj' ? 'body' : type
}

/** The shape in a layout or master that a slide's placeholder takes its position and style from. */
function findPlaceholderShape(
  part: Part | undefined,
  placeholder: Placeholder,
  isMaster: boolean,
): Element | undefined {
  if (!part) {
    return undefined
  }

  const candidates = descendants(part.document, NS.p, 'sp')
    .map(shape => ({ shape, placeholder: readPlaceholder(shape) }))
    .filter(
      (candidate): candidate is { shape: Element; placeholder: Placeholder } =>
        candidate.placeholder !== undefined,
    )

  if (!isMaster && placeholder.index !== undefined) {
    const byIndex = candidates.find(candidate => candidate.placeholder.index === placeholder.index)

    if (byIndex) {
      return byIndex.shape
    }
  }

  const wanted = isMaster ? masterType(placeholder.type) : placeholder.type

  return candidates.find(candidate =>
    (isMaster ? masterType(candidate.placeholder.type) : candidate.placeholder.type) === wanted,
  )?.shape
}

function readXfrm(xfrm: Element | undefined): Frame | undefined {
  const offset = child(xfrm, NS.a, 'off')
  const extent = child(xfrm, NS.a, 'ext')
  const x = intAttribute(offset, 'x')
  const y = intAttribute(offset, 'y')
  const width = intAttribute(extent, 'cx')
  const height = intAttribute(extent, 'cy')

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return undefined
  }

  return { x, y, width, height, rotation: (intAttribute(xfrm, 'rot') ?? 0) / 60_000 }
}

/** A shape's own frame: `spPr/xfrm`, or `xfrm` directly for a table's frame. */
function ownFrame(shape: Element): Frame | undefined {
  return (
    readXfrm(childAt(shape, [NS.p, 'spPr'], [NS.a, 'xfrm'])) ??
    readXfrm(child(shape, NS.p, 'xfrm'))
  )
}

/** Where a shape sits: its own position, else its placeholder's on the layout, else on the master. */
function resolveFrame(shape: Element, inherited: readonly (Element | undefined)[]): Frame | undefined {
  for (const candidate of [shape, ...inherited]) {
    const frame = candidate ? ownFrame(candidate) : undefined

    if (frame) {
      return frame
    }
  }

  return undefined
}

// --- Text ------------------------------------------------------------------

interface TextContext {
  readonly colors: ColorContext
  readonly fonts: Master['fonts']
  /** For each paragraph level, the elements its properties are inherited from, nearest first. */
  readonly levelSources: (level: number) => readonly Element[]
  readonly fontScale: number
  readonly category: TextCategory
}

function levelProperties(listStyle: Element | undefined, level: number): Element | undefined {
  return child(listStyle, NS.a, `lvl${level + 1}pPr`)
}

function firstAttribute(sources: readonly (Element | undefined)[], name: string): string | undefined {
  for (const source of sources) {
    const value = source?.getAttribute(name)

    if (value) {
      return value
    }
  }

  return undefined
}

function resolveFont(typeface: string | undefined, context: TextContext): string | undefined {
  if (typeface === '+mj-lt') {
    return context.fonts.major
  }

  if (typeface === '+mn-lt') {
    return context.fonts.minor
  }

  return safeFont(typeface) ?? (context.category === 'title' ? context.fonts.major : context.fonts.minor)
}

function readRun(
  text: string,
  runProperties: Element | undefined,
  level: number,
  context: TextContext,
): TextRun {
  const sources = [
    runProperties,
    ...context.levelSources(level).map(properties => child(properties, NS.a, 'defRPr')),
  ]
  const size = firstAttribute(sources, 'sz')
  const underline = firstAttribute(sources, 'u')
  let color: string | undefined

  for (const source of sources) {
    const fill = child(source, NS.a, 'solidFill')

    if (fill) {
      color = readColor(fill, context.colors)
      break
    }
  }

  const font = resolveFont(
    sources.map(source => child(source, NS.a, 'latin')?.getAttribute('typeface')).find(Boolean) ??
      undefined,
    context,
  )

  return {
    text,
    sizePt: ((size ? Number.parseInt(size, 10) / 100 : DEFAULT_TEXT_SIZE_PT) || DEFAULT_TEXT_SIZE_PT) *
      context.fontScale,
    bold: firstAttribute(sources, 'b') === '1' || firstAttribute(sources, 'b') === 'true',
    italic: firstAttribute(sources, 'i') === '1' || firstAttribute(sources, 'i') === 'true',
    underline: underline !== undefined && underline !== 'none',
    ...(color ? { color } : {}),
    ...(font ? { font } : {}),
  }
}

const ALIGNMENTS: Readonly<Record<string, Paragraph['align']>> = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  dist: 'justify',
}

function toLetters(number: number): string {
  let value = number
  let letters = ''

  while (value > 0) {
    value -= 1
    letters = String.fromCharCode(97 + (value % 26)) + letters
    value = Math.floor(value / 26)
  }

  return letters
}

function formatAutoNumber(scheme: string, number: number): string {
  const value = scheme.startsWith('alphaUc')
    ? toLetters(number).toUpperCase()
    : scheme.startsWith('alphaLc')
      ? toLetters(number)
      : String(number)

  if (scheme.endsWith('ParenR')) {
    return `${value})`
  }

  if (scheme.endsWith('ParenBoth')) {
    return `(${value})`
  }

  return `${value}.`
}

/** The bullet the nearest level properties ask for: a character, a number, or none. */
function readBullet(
  sources: readonly Element[],
): { readonly kind: 'none' } | { readonly kind: 'char'; readonly char: string } | { readonly kind: 'number'; readonly scheme: string; readonly start: number } {
  for (const source of sources) {
    if (child(source, NS.a, 'buNone')) {
      return { kind: 'none' }
    }

    const character = child(source, NS.a, 'buChar')?.getAttribute('char')

    if (character) {
      return { kind: 'char', char: character }
    }

    const autoNumber = child(source, NS.a, 'buAutoNum')

    if (autoNumber) {
      return {
        kind: 'number',
        scheme: autoNumber.getAttribute('type') ?? 'arabicPeriod',
        start: intAttribute(autoNumber, 'startAt') ?? 1,
      }
    }
  }

  return { kind: 'none' }
}

function readParagraphs(textBody: Element | undefined, context: TextContext): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const counters = new Map<number, number>()

  for (const paragraph of children(textBody, NS.a, 'p')) {
    const ownProperties = child(paragraph, NS.a, 'pPr')
    const level = Math.min(8, Math.max(0, intAttribute(ownProperties, 'lvl') ?? 0))
    const sources = [ownProperties, ...context.levelSources(level)].filter(
      (source): source is Element => source !== undefined,
    )
    const runs: TextRun[] = []

    for (const part of children(paragraph, NS.a)) {
      if (part.localName === 'r' || part.localName === 'fld') {
        const text = child(part, NS.a, 't')?.textContent ?? ''

        if (text) {
          runs.push(readRun(text, child(part, NS.a, 'rPr'), level, context))
        }
      } else if (part.localName === 'br') {
        runs.push(readRun('\n', child(part, NS.a, 'rPr'), level, context))
      }
    }

    const hasText = runs.some(run => run.text.trim() !== '')
    const bullet = hasText ? readBullet(sources) : { kind: 'none' as const }
    let bulletText: string | undefined

    if (bullet.kind === 'number') {
      const next = (counters.get(level) ?? bullet.start - 1) + 1
      counters.set(level, next)
      bulletText = formatAutoNumber(bullet.scheme, next)
    } else {
      counters.delete(level)
      bulletText = bullet.kind === 'char' ? bullet.char : undefined
    }

    // Deeper levels restart their numbering under a new parent.
    for (const counted of [...counters.keys()]) {
      if (counted > level) {
        counters.delete(counted)
      }
    }

    paragraphs.push({
      runs,
      level,
      align: ALIGNMENTS[firstAttribute(sources, 'algn') ?? ''] ?? 'left',
      ...(bulletText ? { bullet: bulletText } : {}),
      emptySizePt: readRun('', child(paragraph, NS.a, 'endParaRPr'), level, context).sizePt,
    })
  }

  return paragraphs
}

function readTextBody(
  textBody: Element | undefined,
  inheritedBodies: readonly (Element | undefined)[],
  context: TextContext,
): TextBody | undefined {
  const paragraphs = readParagraphs(textBody, context)

  if (!paragraphs.some(paragraph => paragraph.runs.some(run => run.text.trim() !== ''))) {
    return undefined
  }

  const bodyProperties = [textBody, ...inheritedBodies].map(body => child(body, NS.a, 'bodyPr'))
  const inset = (name: string, fallback: number) => {
    for (const properties of bodyProperties) {
      const value = intAttribute(properties, name)

      if (value !== undefined) {
        return value
      }
    }

    return fallback
  }
  const anchor = firstAttribute(bodyProperties, 'anchor')

  return {
    paragraphs,
    anchor: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top',
    insets: {
      top: inset('tIns', DEFAULT_INSETS.top),
      right: inset('rIns', DEFAULT_INSETS.right),
      bottom: inset('bIns', DEFAULT_INSETS.bottom),
      left: inset('lIns', DEFAULT_INSETS.left),
    },
  }
}

// --- Elements ----------------------------------------------------------------

interface ShapeScope {
  readonly part: Part
  readonly layout?: Layout
  readonly master: Master
  /** Placeholders only shape a slide; on a layout or master they are templates, not content. */
  readonly includePlaceholders: boolean
}

/**
 * The outline a shape is drawn with, when it is one the view can draw
 * faithfully. Anything else — a pie slice, an arrow, a star, a free-form
 * path — is `undefined`: drawing it as a box would put a shape on the slide
 * that the deck does not have, so such a shape keeps only its text.
 */
function readGeometry(properties: Element | undefined): ShapeGeometry | undefined {
  if (child(properties, NS.a, 'custGeom')) {
    return undefined
  }

  const preset = child(properties, NS.a, 'prstGeom')?.getAttribute('prst')

  switch (preset) {
    case undefined:
    case 'rect':
      return 'rectangle'
    case 'roundRect':
      return 'rounded-rectangle'
    case 'ellipse':
      return 'ellipse'
    default:
      return undefined
  }
}

/** A shape's fill: its own, else the theme style it references. `undefined` for none. */
function readShapeFill(shape: Element, colors: ColorContext): string | undefined {
  const own = readFill(child(shape, NS.p, 'spPr'), colors)

  if (own !== undefined) {
    return own ?? undefined
  }

  const reference = childAt(shape, [NS.p, 'style'], [NS.a, 'fillRef'])

  return (intAttribute(reference, 'idx') ?? 0) > 0 ? readColor(reference, colors) : undefined
}

function readOutline(shape: Element, colors: ColorContext): { color: string; width: number } | undefined {
  const line = childAt(shape, [NS.p, 'spPr'], [NS.a, 'ln'])
  const width = intAttribute(line, 'w') ?? EMU_PER_POINT
  const own = readFill(line, colors)

  if (own === null) {
    return undefined
  }

  if (own) {
    return { color: own, width }
  }

  const reference = childAt(shape, [NS.p, 'style'], [NS.a, 'lnRef'])
  const color = (intAttribute(reference, 'idx') ?? 0) > 0 ? readColor(reference, colors) : undefined

  return color ? { color, width } : undefined
}

function textContext(
  category: TextCategory,
  listStyles: readonly (Element | undefined)[],
  master: Master,
  fontScale: number,
): TextContext {
  const textStyle = master.textStyles[category]

  return {
    colors: master.colors,
    fonts: master.fonts,
    category,
    fontScale,
    levelSources: level =>
      [...listStyles, textStyle]
        .map(listStyle => levelProperties(listStyle, level))
        .filter((element): element is Element => element !== undefined),
  }
}

function readShape(shape: Element, scope: ShapeScope, transform: Transform): SlideElement | undefined {
  const placeholder = readPlaceholder(shape)

  if (placeholder && !scope.includePlaceholders) {
    return undefined
  }

  const layoutShape = placeholder ? findPlaceholderShape(scope.layout, placeholder, false) : undefined
  const masterShape = placeholder ? findPlaceholderShape(scope.master, placeholder, true) : undefined
  const frame = resolveFrame(shape, [layoutShape, masterShape])

  if (!frame) {
    return undefined
  }

  const textBody = child(shape, NS.p, 'txBody')
  const inheritedBodies = [layoutShape, masterShape].map(source => child(source, NS.p, 'txBody'))
  const fontScale =
    (intAttribute(childAt(textBody, [NS.a, 'bodyPr'], [NS.a, 'normAutofit']), 'fontScale') ?? 100_000) /
    100_000
  const text = readTextBody(
    textBody,
    inheritedBodies,
    textContext(
      categoryOf(placeholder),
      [textBody, ...inheritedBodies].map(body => child(body, NS.a, 'lstStyle')),
      scope.master,
      fontScale,
    ),
  )
  const geometry = readGeometry(child(shape, NS.p, 'spPr'))
  const fill = geometry ? readShapeFill(shape, scope.master.colors) : undefined
  const outline = geometry ? readOutline(shape, scope.master.colors) : undefined

  if (!text && !fill && !outline) {
    return undefined
  }

  return {
    kind: 'shape',
    frame: transform(frame),
    geometry: geometry ?? 'rectangle',
    ...(fill ? { fill } : {}),
    ...(outline ? { outline } : {}),
    ...(text ? { text } : {}),
  }
}

async function readImage(
  pkg: OfficePackage,
  part: Part,
  blip: Element | undefined,
): Promise<Blob | undefined> {
  const id = blip?.getAttributeNS(NS.r, 'embed')
  const relationship = id ? part.relationships.get(id) : undefined
  const extension = relationship?.path.split('.').pop()?.toLowerCase() ?? ''
  const type = IMAGE_TYPES[extension]

  if (!relationship || !type) {
    return undefined
  }

  const bytes = await pkg.image(relationship.path)

  return bytes ? new Blob([bytes as Uint8Array<ArrayBuffer>], { type }) : undefined
}

async function readPicture(
  pkg: OfficePackage,
  picture: Element,
  scope: ShapeScope,
  transform: Transform,
): Promise<SlideElement | undefined> {
  const placeholder = readPlaceholder(picture)

  if (placeholder && !scope.includePlaceholders) {
    return undefined
  }

  const inherited = placeholder
    ? [
        findPlaceholderShape(scope.layout, placeholder, false),
        findPlaceholderShape(scope.master, placeholder, true),
      ]
    : []
  const frame = resolveFrame(picture, inherited)
  const image = await readImage(
    pkg,
    scope.part,
    childAt(picture, [NS.p, 'blipFill'], [NS.a, 'blip']),
  )

  return frame && image ? { kind: 'picture', frame: transform(frame), image } : undefined
}

function readTable(frameElement: Element, scope: ShapeScope, transform: Transform): SlideElement | undefined {
  const table = childAt(frameElement, [NS.a, 'graphic'], [NS.a, 'graphicData'], [NS.a, 'tbl'])
  const frame = readXfrm(child(frameElement, NS.p, 'xfrm'))

  if (!table || !frame) {
    return undefined
  }

  const context = textContext('other', [], scope.master, 1)
  const rows = children(table, NS.a, 'tr').map(row =>
    children(row, NS.a, 'tc').map((cell): TableCell => {
      const fill = readFill(child(cell, NS.a, 'tcPr'), scope.master.colors)

      return {
        paragraphs: readParagraphs(child(cell, NS.a, 'txBody'), context),
        ...(fill ? { fill } : {}),
      }
    }),
  )

  return rows.length > 0 ? { kind: 'table', frame: transform(frame), rows } : undefined
}

/** The transform from a group's child coordinates to its parent's. */
function groupTransform(group: Element, parent: Transform): Transform {
  const xfrm = childAt(group, [NS.p, 'grpSpPr'], [NS.a, 'xfrm'])
  const outer = readXfrm(xfrm)
  const childOffset = child(xfrm, NS.a, 'chOff')
  const childExtent = child(xfrm, NS.a, 'chExt')
  const childX = intAttribute(childOffset, 'x') ?? 0
  const childY = intAttribute(childOffset, 'y') ?? 0
  const childWidth = intAttribute(childExtent, 'cx') ?? 0
  const childHeight = intAttribute(childExtent, 'cy') ?? 0

  if (!outer || childWidth <= 0 || childHeight <= 0) {
    return parent
  }

  const scaleX = outer.width / childWidth
  const scaleY = outer.height / childHeight

  return frame =>
    parent({
      x: outer.x + (frame.x - childX) * scaleX,
      y: outer.y + (frame.y - childY) * scaleY,
      width: frame.width * scaleX,
      height: frame.height * scaleY,
      rotation: frame.rotation,
    })
}

async function readShapeTree(
  pkg: OfficePackage,
  tree: Element | undefined,
  scope: ShapeScope,
  transform: Transform = IDENTITY,
): Promise<SlideElement[]> {
  const elements: SlideElement[] = []

  for (const node of children(tree, NS.p)) {
    switch (node.localName) {
      case 'sp': {
        const shape = readShape(node, scope, transform)

        if (shape) {
          elements.push(shape)
        }
        break
      }
      case 'pic': {
        const picture = await readPicture(pkg, node, scope, transform)

        if (picture) {
          elements.push(picture)
        }
        break
      }
      case 'graphicFrame': {
        const table = readTable(node, scope, transform)

        if (table) {
          elements.push(table)
        }
        break
      }
      case 'grpSp':
        elements.push(...(await readShapeTree(pkg, node, scope, groupTransform(node, transform))))
        break
      default:
        break
    }
  }

  return elements
}

function shapeTreeOf(part: Part): Element | undefined {
  return childAt(part.document.documentElement, [NS.p, 'cSld'], [NS.p, 'spTree'])
}

// --- Slides ------------------------------------------------------------------

async function readBackground(
  pkg: OfficePackage,
  part: Part,
  colors: ColorContext,
): Promise<SlideFill | undefined> {
  const background = childAt(part.document.documentElement, [NS.p, 'cSld'], [NS.p, 'bg'])
  const properties = child(background, NS.p, 'bgPr')

  if (properties) {
    const image = await readImage(pkg, part, childAt(properties, [NS.a, 'blipFill'], [NS.a, 'blip']))

    if (image) {
      return { kind: 'image', image }
    }

    const color = readFill(properties, colors)

    return color ? { kind: 'color', color } : undefined
  }

  const color = readColor(child(background, NS.p, 'bgRef'), colors)

  return color ? { kind: 'color', color } : undefined
}

/** Whether a slide or layout shows the shapes of the part above it (`showMasterSp`). */
function showsMasterShapes(part: Part): boolean {
  return boolAttribute(part.document.documentElement, 'showMasterSp') !== false
}

async function readSlide(
  pkg: OfficePackage,
  cache: PartCache,
  path: string,
  number: number,
): Promise<Slide | undefined> {
  const part = await readPart(pkg, path)
  const layoutPath = part ? relatedPath(part, 'slideLayout') : undefined
  const layout = layoutPath ? await cache.layout(layoutPath) : undefined

  if (!part || !layout) {
    return undefined
  }

  const { master } = layout
  const elements: SlideElement[] = []

  if (showsMasterShapes(part)) {
    if (showsMasterShapes(layout)) {
      elements.push(
        ...(await readShapeTree(pkg, shapeTreeOf(master), {
          part: master,
          master,
          includePlaceholders: false,
        })),
      )
    }

    elements.push(
      ...(await readShapeTree(pkg, shapeTreeOf(layout), {
        part: layout,
        master,
        includePlaceholders: false,
      })),
    )
  }

  elements.push(
    ...(await readShapeTree(pkg, shapeTreeOf(part), {
      part,
      layout,
      master,
      includePlaceholders: true,
    })),
  )

  const background =
    (await readBackground(pkg, part, master.colors)) ??
    (await readBackground(pkg, layout, master.colors)) ??
    (await readBackground(pkg, master, master.colors)) ?? { kind: 'color', color: '#ffffff' }

  return { number, background, elements }
}

/**
 * Reads a `.pptx` file's bytes into its first `PRESENTATION_MAX_SLIDES` slides.
 *
 * @throws OfficePackageError when the bytes are not a presentation, or are too large.
 */
export async function readPresentation(
  bytes: ArrayBuffer,
  { parseXml }: { readonly parseXml: ParseXml },
): Promise<Presentation> {
  const pkg = await OfficePackage.open(bytes, parseXml)
  const presentationPath = 'ppt/presentation.xml'
  const presentation = await readPart(pkg, presentationPath)

  if (!presentation) {
    throw new OfficePackageError('Not a PowerPoint presentation.')
  }

  const root = presentation.document.documentElement
  const size = child(root, NS.p, 'sldSz')
  const slidePaths = children(child(root, NS.p, 'sldIdLst'), NS.p, 'sldId')
    .map(slideId => presentation.relationships.get(slideId.getAttributeNS(NS.r, 'id') ?? '')?.path)
    .filter((path): path is string => path !== undefined)
  const cache = new PartCache(pkg)
  const slides: Slide[] = []

  for (const [index, path] of slidePaths.slice(0, PRESENTATION_MAX_SLIDES).entries()) {
    const slide = await readSlide(pkg, cache, path, index + 1)

    if (slide) {
      slides.push(slide)
    }
  }

  return {
    width: intAttribute(size, 'cx') ?? DEFAULT_SLIDE_SIZE.width,
    height: intAttribute(size, 'cy') ?? DEFAULT_SLIDE_SIZE.height,
    slides,
    totalSlides: slidePaths.length,
    isTruncated: slidePaths.length > PRESENTATION_MAX_SLIDES,
  }
}
