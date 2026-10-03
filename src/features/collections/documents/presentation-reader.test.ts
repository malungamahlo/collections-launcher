import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  buildPresentation,
  paragraph,
  parseXml,
  picture,
  placeholder,
  PNG_BYTES,
  textBox,
} from '../test/pptx.fixtures'
import { OfficePackageError } from './office-package'
import { PRESENTATION_MAX_SLIDES } from './document-limits'
import { readPresentation } from './presentation-reader'
import type { SlideElement } from './presentation.types'

function read(bytes: ArrayBuffer) {
  return readPresentation(bytes, { parseXml })
}

/** The text of a shape element, paragraph by paragraph. */
function textOf(element: SlideElement | undefined): string[] {
  return element?.kind === 'shape' && element.text
    ? element.text.paragraphs.map(item => item.runs.map(run => run.text).join(''))
    : []
}

describe('readPresentation', () => {
  it('reads the slide size and every slide, in order', async () => {
    const presentation = await read(
      await buildPresentation({
        size: { width: 12_192_000, height: 6_858_000 },
        slides: [
          { shapes: textBox(paragraph('First')) },
          { shapes: textBox(paragraph('Second')) },
        ],
      }),
    )

    expect(presentation).toMatchObject({
      width: 12_192_000,
      height: 6_858_000,
      totalSlides: 2,
      isTruncated: false,
    })
    expect(presentation.slides.map(slide => slide.number)).toEqual([1, 2])
    expect(presentation.slides.map(slide => textOf(slide.elements[0]))).toEqual([
      ['First'],
      ['Second'],
    ])
  })

  it('places a text box where the file puts it, with its run formatting', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox(
              paragraph('Bold red', 'sz="2400" b="1" i="1" u="sng"', '<a:pPr algn="r"/>').replace(
                '<a:rPr sz="2400" b="1" i="1" u="sng"/>',
                '<a:rPr sz="2400" b="1" i="1" u="sng"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:latin typeface="Georgia"/></a:rPr>',
              ),
              { x: 10, y: 20, width: 300, height: 40 },
            ),
          },
        ],
      }),
    )
    const [element] = presentation.slides[0]?.elements ?? []

    expect(element?.kind).toBe('shape')
    expect(element?.frame).toEqual({ x: 10, y: 20, width: 300, height: 40, rotation: 0 })
    if (element?.kind === 'shape') {
      expect(element.text?.paragraphs[0]?.align).toBe('right')
      expect(element.text?.paragraphs[0]?.runs[0]).toEqual({
        text: 'Bold red',
        sizePt: 24,
        bold: true,
        italic: true,
        underline: true,
        color: '#ff0000',
        font: 'Georgia',
      })
    }
  })

  it('gives a placeholder the master’s position and text style when the slide sets neither', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes:
              placeholder('title', paragraph('My title')) +
              placeholder('body', paragraph('Point one') + paragraph('Point two'), '1'),
          },
        ],
      }),
    )
    const [title, body] = presentation.slides[0]?.elements ?? []

    expect(title?.frame).toMatchObject({ x: 100, y: 200, width: 3000, height: 400 })
    if (title?.kind === 'shape') {
      expect(title.text?.anchor).toBe('middle')
      expect(title.text?.paragraphs[0]).toMatchObject({ align: 'center' })
      expect(title.text?.paragraphs[0]?.runs[0]).toMatchObject({
        sizePt: 44,
        color: '#000000',
        font: 'Heading Font',
      })
      expect(title.text?.paragraphs[0]?.bullet).toBeUndefined()
    }
    expect(body?.frame).toMatchObject({ x: 100, y: 700 })
    if (body?.kind === 'shape') {
      expect(body.text?.paragraphs.map(item => item.bullet)).toEqual(['•', '•'])
      expect(body.text?.paragraphs[0]?.runs[0]).toMatchObject({ sizePt: 28, font: 'Body Font' })
    }
  })

  it('takes a deeper paragraph’s style from its own level', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: placeholder(
              'body',
              paragraph('Top') + paragraph('Nested', '', '<a:pPr lvl="1"/>'),
              '1',
            ),
          },
        ],
      }),
    )
    const [body] = presentation.slides[0]?.elements ?? []

    if (body?.kind === 'shape') {
      expect(body.text?.paragraphs[1]).toMatchObject({ level: 1, bullet: '–' })
      expect(body.text?.paragraphs[1]?.runs[0]?.sizePt).toBe(24)
    }
  })

  it('numbers an auto-numbered list', async () => {
    const numbered = '<a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr>'
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox(
              paragraph('One', '', numbered) + paragraph('Two', '', numbered) + paragraph('Three', '', numbered),
            ),
          },
        ],
      }),
    )
    const [box] = presentation.slides[0]?.elements ?? []

    if (box?.kind === 'shape') {
      expect(box.text?.paragraphs.map(item => item.bullet)).toEqual(['1.', '2.', '3.'])
    }
  })

  it('resolves theme colours, with their brightness adjustments', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox(
              '<a:p><a:r><a:rPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:rPr><a:t>Accent</a:t></a:r></a:p>' +
                '<a:p><a:r><a:rPr><a:solidFill><a:schemeClr val="bg1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></a:rPr><a:t>Grey</a:t></a:r></a:p>',
            ),
          },
        ],
      }),
    )
    const [box] = presentation.slides[0]?.elements ?? []

    if (box?.kind === 'shape') {
      expect(box.text?.paragraphs.map(item => item.runs[0]?.color)).toEqual([
        '#2563eb',
        '#808080',
      ])
    }
  })

  it('scales text a box shrinks to fit', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox(paragraph('Shrunk', 'sz="2000"')).replace(
              '<a:bodyPr/>',
              '<a:bodyPr><a:normAutofit fontScale="50000"/></a:bodyPr>',
            ),
          },
        ],
      }),
    )
    const [box] = presentation.slides[0]?.elements ?? []

    if (box?.kind === 'shape') {
      expect(box.text?.paragraphs[0]?.runs[0]?.sizePt).toBe(10)
    }
  })

  it('reads a filled shape and its outline, and its geometry', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox('<a:p/>', {
              extra:
                '<a:prstGeom prst="ellipse"/><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill><a:ln w="25400"><a:solidFill><a:srgbClr val="0000FF"/></a:solidFill></a:ln>',
            }),
          },
        ],
      }),
    )

    expect(presentation.slides[0]?.elements[0]).toMatchObject({
      kind: 'shape',
      geometry: 'ellipse',
      fill: '#00ff00',
      outline: { color: '#0000ff', width: 25_400 },
    })
  })

  it.each([['pie'], ['rightArrow'], ['star5']])(
    'does not draw a %s as a box it is not, but keeps its text',
    async preset => {
      const filled = '<a:solidFill><a:srgbClr val="424242"/></a:solidFill>'
      const presentation = await read(
        await buildPresentation({
          slides: [
            {
              shapes:
                textBox('<a:p/>', { extra: `<a:prstGeom prst="${preset}"/>${filled}` }) +
                textBox(paragraph('Label'), { extra: `<a:prstGeom prst="${preset}"/>${filled}` }),
            },
          ],
        }),
      )

      expect(presentation.slides[0]?.elements).toHaveLength(1)
      expect(presentation.slides[0]?.elements[0]).not.toHaveProperty('fill')
      expect(textOf(presentation.slides[0]?.elements[0])).toEqual(['Label'])
    },
  )

  it('does not draw a free-form shape as a box', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox('<a:p/>', {
              extra:
                '<a:custGeom><a:pathLst/></a:custGeom><a:solidFill><a:srgbClr val="424242"/></a:solidFill>',
            }),
          },
        ],
      }),
    )

    expect(presentation.slides[0]?.elements).toEqual([])
  })

  it('leaves out an empty, unfilled box — as PowerPoint shows nothing for it', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [{ shapes: textBox('<a:p/>') + placeholder('body', '<a:p/>', '1') }],
      }),
    )

    expect(presentation.slides[0]?.elements).toEqual([])
  })

  it('reads a picture’s bytes, typed by its extension', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: picture('rIdImage', { x: 5, y: 6, width: 70, height: 80 }),
            relationships: { rIdImage: '../media/image1.png' },
          },
        ],
        files: { 'ppt/media/image1.png': PNG_BYTES },
      }),
    )
    const [element] = presentation.slides[0]?.elements ?? []

    expect(element?.kind).toBe('picture')
    if (element?.kind === 'picture') {
      expect(element.frame).toMatchObject({ x: 5, y: 6, width: 70, height: 80 })
      expect(element.image.type).toBe('image/png')
      expect(element.image.size).toBe(PNG_BYTES.byteLength)
    }
  })

  it('leaves out a picture in a format a browser cannot show, or one that is missing', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: picture('rIdEmf') + picture('rIdMissing'),
            relationships: { rIdEmf: '../media/image1.emf', rIdMissing: '../media/gone.png' },
          },
        ],
        files: { 'ppt/media/image1.emf': PNG_BYTES },
      }),
    )

    expect(presentation.slides[0]?.elements).toEqual([])
  })

  it('never follows a link to a picture outside the file', async () => {
    const bytes = await buildPresentation({
      slides: [{ shapes: picture('rIdRemote') }],
    })
    // Rewrite the slide's relationships to point the picture at the web.
    const zip = await JSZip.loadAsync(bytes)
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
        <Relationship Id="rIdRemote" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://tracker.example/pixel.png" TargetMode="External"/>
      </Relationships>`,
    )

    const presentation = await read(await zip.generateAsync({ type: 'arraybuffer' }))

    expect(presentation.slides[0]?.elements).toEqual([])
  })

  it('draws the master’s decoration under the slide, unless the slide hides it', async () => {
    const decoration = textBox('<a:p/>', {
      extra: '<a:solidFill><a:srgbClr val="123456"/></a:solidFill>',
    })
    const presentation = await read(
      await buildPresentation({
        masterShapes: decoration,
        slides: [
          { shapes: textBox(paragraph('Over it')) },
          { shapes: textBox(paragraph('Plain')), showMasterShapes: false },
        ],
      }),
    )

    expect(
      presentation.slides[0]?.elements.map(element =>
        element.kind === 'shape' ? (element.fill ?? 'no fill') : element.kind,
      ),
    ).toEqual(['#123456', 'no fill'])
    expect(presentation.slides[1]?.elements).toHaveLength(1)
  })

  it('takes the background from the slide, else the master, else white', async () => {
    const presentation = await read(
      await buildPresentation({
        masterBackground: '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="EEEEEE"/></a:solidFill></p:bgPr></p:bg>',
        slides: [
          {
            shapes: '',
            background: '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></p:bgPr></p:bg>',
          },
          { shapes: '' },
        ],
      }),
    )

    expect(presentation.slides.map(slide => slide.background)).toEqual([
      { kind: 'color', color: '#dc2626' },
      { kind: 'color', color: '#eeeeee' },
    ])
  })

  it('places a grouped shape through its group’s scaling', async () => {
    const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="1000" y="1000"/><a:ext cx="200" cy="200"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm></p:grpSpPr>
      ${textBox(paragraph('Inside'), { x: 10, y: 20, width: 30, height: 40 })}</p:grpSp>`
    const presentation = await read(await buildPresentation({ slides: [{ shapes: group }] }))

    expect(presentation.slides[0]?.elements[0]?.frame).toEqual({
      x: 1020,
      y: 1040,
      width: 60,
      height: 80,
      rotation: 0,
    })
  })

  it('reads a table’s cells', async () => {
    const table = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="30" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
      <p:xfrm><a:off x="0" y="0"/><a:ext cx="1000" cy="500"/></p:xfrm>
      <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>
        <a:tr h="100"><a:tc><a:txBody><a:bodyPr/>${paragraph('Name')}</a:txBody><a:tcPr><a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill></a:tcPr></a:tc><a:tc><a:txBody><a:bodyPr/>${paragraph('Score')}</a:txBody><a:tcPr/></a:tc></a:tr>
        <a:tr h="100"><a:tc><a:txBody><a:bodyPr/>${paragraph('Ann')}</a:txBody><a:tcPr/></a:tc><a:tc><a:txBody><a:bodyPr/>${paragraph('9')}</a:txBody><a:tcPr/></a:tc></a:tr>
      </a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    const presentation = await read(await buildPresentation({ slides: [{ shapes: table }] }))
    const [element] = presentation.slides[0]?.elements ?? []

    expect(element?.kind).toBe('table')
    if (element?.kind === 'table') {
      expect(element.rows.map(row => row.map(cell => cell.paragraphs[0]?.runs[0]?.text))).toEqual([
        ['Name', 'Score'],
        ['Ann', '9'],
      ])
      expect(element.rows[0]?.[0]?.fill).toBe('#cccccc')
    }
  })

  it('keeps only a safe font name, falling back to the theme’s', async () => {
    const presentation = await read(
      await buildPresentation({
        slides: [
          {
            shapes: textBox(
              '<a:p><a:r><a:rPr><a:latin typeface="x;}body{display:none"/></a:rPr><a:t>Hi</a:t></a:r></a:p>',
            ),
          },
        ],
      }),
    )
    const [box] = presentation.slides[0]?.elements ?? []

    if (box?.kind === 'shape') {
      expect(box.text?.paragraphs[0]?.runs[0]?.font).toBe('Body Font')
    }
  })

  it('shows only the first slides of a very long deck, and says so', async () => {
    const slides = Array.from({ length: PRESENTATION_MAX_SLIDES + 3 }, () => ({ shapes: '' }))

    const presentation = await read(await buildPresentation({ slides }))

    expect(presentation.slides).toHaveLength(PRESENTATION_MAX_SLIDES)
    expect(presentation).toMatchObject({
      totalSlides: PRESENTATION_MAX_SLIDES + 3,
      isTruncated: true,
    })
  })

  it('rejects bytes that are not a zip, and a zip that is not a presentation', async () => {
    await expect(read(new TextEncoder().encode('not a zip').buffer)).rejects.toBeInstanceOf(
      OfficePackageError,
    )

    const zip = new JSZip()
    zip.file('word/document.xml', '<w:document/>')
    await expect(read(await zip.generateAsync({ type: 'arraybuffer' }))).rejects.toBeInstanceOf(
      OfficePackageError,
    )
  })

  it('refuses a picture that unpacks to far more than any real one', async () => {
    const huge = new Uint8Array(31 * 1024 * 1024)
    const bytes = await buildPresentation({
      slides: [{ shapes: picture('rIdImage'), relationships: { rIdImage: '../media/huge.png' } }],
      files: { 'ppt/media/huge.png': huge },
    })

    await expect(read(bytes)).rejects.toThrow('too large')
  })

  it('skips a slide whose XML is broken, rather than failing the whole deck', async () => {
    const bytes = await buildPresentation({
      slides: [{ shapes: textBox(paragraph('Fine')) }, { shapes: textBox(paragraph('Broken')) }],
    })
    const zip = await JSZip.loadAsync(bytes)
    zip.file('ppt/slides/slide2.xml', '<p:sld><unclosed>')

    const presentation = await read(await zip.generateAsync({ type: 'arraybuffer' }))

    expect(presentation.slides.map(slide => slide.number)).toEqual([1])
  })
})
