import { DOMParser } from '@xmldom/xmldom'
import JSZip from 'jszip'
import type { ParseXml } from '../documents/office-package'

/**
 * Builds small but real `.pptx` files in memory for the presentation reader's
 * tests: a presentation, one master with a theme, one layout, and the slides
 * given. Each slide's shape tree is written by the test as XML, so a test
 * shows exactly what the file contains.
 */

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** The XML parser the app would use, for a test (happy-dom cannot parse namespaced XML). */
export const parseXml: ParseXml = text =>
  new DOMParser().parseFromString(text, 'application/xml') as unknown as Document

export interface TestSlide {
  /** The children of the slide's `p:spTree`. */
  readonly shapes: string
  /** The slide's own `p:bg`, if any. */
  readonly background?: string
  /** Extra relationships: id → target (relative to `ppt/slides/`). */
  readonly relationships?: Readonly<Record<string, string>>
  readonly showMasterShapes?: boolean
}

export interface TestPresentation {
  readonly slides: readonly TestSlide[]
  /** Shapes on the master (decoration and placeholders). */
  readonly masterShapes?: string
  /** Shapes on the layout. */
  readonly layoutShapes?: string
  readonly masterBackground?: string
  readonly masterTextStyles?: string
  readonly size?: { readonly width: number; readonly height: number }
  /** Extra files in the package: path → bytes or text. */
  readonly files?: Readonly<Record<string, Uint8Array | string>>
}

function relationships(entries: Readonly<Record<string, readonly [string, string]>>): string {
  return `<Relationships xmlns="${RELS}">${Object.entries(entries)
    .map(([id, [type, target]]) => `<Relationship Id="${id}" Type="${TYPE}/${type}" Target="${target}"/>`)
    .join('')}</Relationships>`
}

/** A shape tree with the group properties PowerPoint always writes. */
function tree(shapes: string): string {
  return `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld>`
}

const NAMESPACES = `xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"`

const THEME = `<a:theme xmlns:a="${A}" name="Test"><a:themeElements>
  <a:clrScheme name="Test">
    <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
    <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
    <a:dk2><a:srgbClr val="1F2937"/></a:dk2>
    <a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>
    <a:accent1><a:srgbClr val="2563EB"/></a:accent1>
    <a:accent2><a:srgbClr val="DC2626"/></a:accent2>
  </a:clrScheme>
  <a:fontScheme name="Test">
    <a:majorFont><a:latin typeface="Heading Font"/></a:majorFont>
    <a:minorFont><a:latin typeface="Body Font"/></a:minorFont>
  </a:fontScheme>
</a:themeElements></a:theme>`

const DEFAULT_TEXT_STYLES = `<p:txStyles>
  <p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="4400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle>
  <p:bodyStyle>
    <a:lvl1pPr><a:buChar char="•"/><a:defRPr sz="2800"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:defRPr></a:lvl1pPr>
    <a:lvl2pPr><a:buChar char="–"/><a:defRPr sz="2400"/></a:lvl2pPr>
  </p:bodyStyle>
  <p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>
</p:txStyles>`

/** The master's title and body placeholders, where a slide's placeholders sit by default. */
export const MASTER_PLACEHOLDERS = `
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100" y="200"/><a:ext cx="3000" cy="400"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr anchor="ctr"/><a:p/></p:txBody></p:sp>
  <p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100" y="700"/><a:ext cx="3000" cy="2000"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:p/></p:txBody></p:sp>`

/** Writes a presentation package and returns its bytes. */
export async function buildPresentation(presentation: TestPresentation): Promise<ArrayBuffer> {
  const zip = new JSZip()
  const size = presentation.size ?? { width: 9_144_000, height: 5_143_500 }
  const slideIds = presentation.slides
    .map((_, index) => `<p:sldId id="${256 + index}" r:id="rIdSlide${index + 1}"/>`)
    .join('')
  const presentationRelationships: Record<string, readonly [string, string]> = {
    rIdMaster: ['slideMaster', 'slideMasters/slideMaster1.xml'],
  }

  presentation.slides.forEach((slide, index) => {
    const number = index + 1
    presentationRelationships[`rIdSlide${number}`] = ['slide', `slides/slide${number}.xml`]
    const slideRelationships: Record<string, readonly [string, string]> = {
      rIdLayout: ['slideLayout', '../slideLayouts/slideLayout1.xml'],
    }

    for (const [id, target] of Object.entries(slide.relationships ?? {})) {
      slideRelationships[id] = [target.includes('media') ? 'image' : 'other', target]
    }

    const showMaster = slide.showMasterShapes === false ? ' showMasterSp="0"' : ''
    zip.file(
      `ppt/slides/slide${number}.xml`,
      `<p:sld ${NAMESPACES}${showMaster}>${
        slide.background ? `<p:cSld>${slide.background}` : ''
      }${slide.background ? tree(slide.shapes).replace('<p:cSld>', '') : tree(slide.shapes)}</p:sld>`,
    )
    zip.file(`ppt/slides/_rels/slide${number}.xml.rels`, relationships(slideRelationships))
  })

  zip.file(
    'ppt/presentation.xml',
    `<p:presentation ${NAMESPACES}><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${size.width}" cy="${size.height}"/></p:presentation>`,
  )
  zip.file('ppt/_rels/presentation.xml.rels', relationships(presentationRelationships))
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<p:sldLayout ${NAMESPACES}>${tree(presentation.layoutShapes ?? '')}</p:sldLayout>`,
  )
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    relationships({ rIdMaster: ['slideMaster', '../slideMasters/slideMaster1.xml'] }),
  )
  const masterBackground = presentation.masterBackground
    ? `<p:cSld>${presentation.masterBackground}${tree(
        presentation.masterShapes ?? MASTER_PLACEHOLDERS,
      ).replace('<p:cSld>', '')}`
    : tree(presentation.masterShapes ?? MASTER_PLACEHOLDERS)
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster ${NAMESPACES}>${masterBackground}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"/>${
      presentation.masterTextStyles ?? DEFAULT_TEXT_STYLES
    }</p:sldMaster>`,
  )
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    relationships({ rIdTheme: ['theme', '../theme/theme1.xml'] }),
  )
  zip.file('ppt/theme/theme1.xml', THEME)

  for (const [path, contents] of Object.entries(presentation.files ?? {})) {
    zip.file(path, contents)
  }

  return zip.generateAsync({ type: 'arraybuffer' })
}

/** A text box at a position, with the given paragraphs (`a:p` elements). */
export function textBox(
  paragraphs: string,
  { x = 0, y = 0, width = 1000, height = 500, extra = '' } = {},
): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="10" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>${extra}</p:spPr>
    <p:txBody><a:bodyPr/>${paragraphs}</p:txBody></p:sp>`
}

/** A placeholder on a slide, with no position of its own (it inherits one). */
export function placeholder(type: string, paragraphs: string, index?: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="11" name="${type}"/><p:cNvSpPr/><p:nvPr><p:ph type="${type}"${
    index ? ` idx="${index}"` : ''
  }/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${paragraphs}</p:txBody></p:sp>`
}

/** A picture referencing a relationship id. */
export function picture(relationshipId: string, { x = 0, y = 0, width = 500, height = 500 } = {}): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="12" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${relationshipId}"/></p:blipFill>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm></p:spPr></p:pic>`
}

/** A one-run paragraph. */
export function paragraph(text: string, runProperties = '', paragraphProperties = ''): string {
  return `<a:p>${paragraphProperties}<a:r><a:rPr ${runProperties}/><a:t>${text}</a:t></a:r></a:p>`
}

/** The eight bytes every PNG starts with, plus a little more — enough to be a "picture" part. */
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
