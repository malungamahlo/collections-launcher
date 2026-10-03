import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RESOURCE_KIND,
  getFileExtension,
  getFilePickerTypes,
  getOpenOptions,
  getResourceKind,
  getViewerStrategy,
  inferMimeType,
  normalizeMimeType,
  RESOURCE_KINDS,
  UNKNOWN_MIME_TYPE,
  type ViewerStrategy,
} from './resource-kind-registry'

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PPTX =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

describe('registry contents', () => {
  it('only ever uses the supported viewer strategies, for kinds and formats alike', () => {
    const allowed: readonly ViewerStrategy[] = [
      'native-pdf',
      'render-markdown',
      'render-word',
      'render-spreadsheet',
      'render-presentation',
      'open-externally',
    ]

    for (const kind of [...RESOURCE_KINDS, DEFAULT_RESOURCE_KIND]) {
      expect(allowed).toContain(kind.viewer)

      for (const format of kind.formats) {
        expect([undefined, ...allowed]).toContain(format.viewer)
      }
    }
  })

  it('has unique kind ids and never lists a MIME type or extension twice', () => {
    const ids = RESOURCE_KINDS.map(kind => kind.id)
    const formats = RESOURCE_KINDS.flatMap(kind => kind.formats)
    const mimeTypes = formats.map(format => format.mimeType)
    const extensions = formats.flatMap(format => format.extensions)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(mimeTypes).size).toBe(mimeTypes.length)
    expect(new Set(extensions).size).toBe(extensions.length)
  })

  it('keeps every MIME type lower-case and every extension lower-case with a leading dot', () => {
    for (const format of RESOURCE_KINDS.flatMap(kind => kind.formats)) {
      expect(format.mimeType).toBe(format.mimeType.toLowerCase())

      for (const extension of format.extensions) {
        expect(extension).toMatch(/^\.[a-z0-9]+$/)
      }
    }
  })

  it('gives PDF the native viewer and Markdown the renderer', () => {
    expect(getViewerStrategy('application/pdf')).toBe('native-pdf')
    expect(getViewerStrategy('text/markdown')).toBe('render-markdown')
  })

  it.each([
    [DOCX, 'render-word'],
    [XLSX, 'render-spreadsheet'],
    ['application/vnd.ms-excel', 'render-spreadsheet'],
    [PPTX, 'render-presentation'],
  ] as const)('draws %s in the browser (%s)', (mimeType, strategy) => {
    expect(getViewerStrategy(mimeType)).toBe(strategy)
  })

  it.each([['application/msword'], ['application/vnd.ms-powerpoint']])(
    'opens the legacy %s only in its application: the browser cannot draw it',
    mimeType => {
      expect(getResourceKind(mimeType)).not.toBe(DEFAULT_RESOURCE_KIND)
      expect(getViewerStrategy(mimeType)).toBe('open-externally')
    },
  )

  it('lets a format override its kind’s strategy, ignoring case and parameters', () => {
    expect(getViewerStrategy('Application/MSWord; foo=bar')).toBe('open-externally')
    expect(getResourceKind('application/msword').viewer).toBe('render-word')
  })
})

describe('getOpenOptions', () => {
  it.each([
    [DOCX, { inBrowser: true, appName: 'Word' }],
    ['application/msword', { inBrowser: false, appName: 'Word' }],
    [XLSX, { inBrowser: true, appName: 'Excel' }],
    ['application/vnd.ms-excel', { inBrowser: true, appName: 'Excel' }],
    [PPTX, { inBrowser: true, appName: 'PowerPoint' }],
    ['application/vnd.ms-powerpoint', { inBrowser: false, appName: 'PowerPoint' }],
    ['application/pdf', { inBrowser: true }],
    ['text/markdown', { inBrowser: true }],
    ['application/x-something-new', { inBrowser: false }],
  ])('offers %s these ways to open', (mimeType, expected) => {
    expect(getOpenOptions(mimeType)).toEqual(expected)
  })
})

describe('normalizeMimeType', () => {
  it('trims, lower-cases, and drops parameters', () => {
    expect(normalizeMimeType('  Text/Markdown; charset=UTF-8 ')).toBe(
      'text/markdown',
    )
  })

  it('returns an empty string for an empty one', () => {
    expect(normalizeMimeType('')).toBe('')
  })
})

describe('getResourceKind', () => {
  it('finds a kind by MIME type, ignoring case and parameters', () => {
    expect(getResourceKind('Application/PDF').id).toBe('pdf')
    expect(getResourceKind('text/markdown; charset=utf-8').id).toBe('markdown')
  })

  it('resolves an unlisted MIME type to the default, opened externally', () => {
    const kind = getResourceKind('application/x-something-new')

    expect(kind).toBe(DEFAULT_RESOURCE_KIND)
    expect(kind.viewer).toBe('open-externally')
  })

  it('resolves an empty MIME type to the default', () => {
    expect(getResourceKind('')).toBe(DEFAULT_RESOURCE_KIND)
  })

  it('does not treat a merely similar type as a match', () => {
    expect(getResourceKind('text/markdown-extra')).toBe(DEFAULT_RESOURCE_KIND)
    expect(getResourceKind('application/pdf2')).toBe(DEFAULT_RESOURCE_KIND)
  })

  it('defaults every unlisted MIME type to open-externally', () => {
    for (const mimeType of ['image/png', 'text/plain', 'video/mp4', 'x/y']) {
      expect(getViewerStrategy(mimeType)).toBe('open-externally')
    }
  })
})

describe('inferMimeType', () => {
  it('maps a registered extension to its canonical MIME type', () => {
    expect(inferMimeType('report.pdf', '')).toBe('application/pdf')
    expect(inferMimeType('notes.md', '')).toBe('text/markdown')
    expect(inferMimeType('notes.markdown', '')).toBe('text/markdown')
    expect(inferMimeType('plan.docx', '')).toBe(DOCX)
    expect(inferMimeType('budget.xlsx', '')).toBe(XLSX)
    expect(inferMimeType('deck.pptx', '')).toBe(PPTX)
  })

  it('maps legacy Office extensions too', () => {
    expect(inferMimeType('old.doc', '')).toBe('application/msword')
    expect(inferMimeType('old.xls', '')).toBe('application/vnd.ms-excel')
    expect(inferMimeType('old.ppt', '')).toBe('application/vnd.ms-powerpoint')
  })

  it('prefers a registered extension over a generic declared type', () => {
    expect(inferMimeType('notes.md', 'text/plain')).toBe('text/markdown')
  })

  it('is case-insensitive about the extension', () => {
    expect(inferMimeType('REPORT.PDF', '')).toBe('application/pdf')
  })

  it('uses only the last extension', () => {
    expect(inferMimeType('archive.pdf.docx', '')).toBe(DOCX)
  })

  it('falls back to the normalized declared type for an unregistered extension', () => {
    expect(inferMimeType('photo.png', 'IMAGE/PNG')).toBe('image/png')
  })

  it('falls back to application/octet-stream when nothing is known', () => {
    expect(inferMimeType('mystery', '')).toBe(UNKNOWN_MIME_TYPE)
    expect(inferMimeType('mystery.zzz', '')).toBe(UNKNOWN_MIME_TYPE)
  })

  it('does not treat a leading-dot name as having an extension', () => {
    expect(inferMimeType('.pdf', '')).toBe(UNKNOWN_MIME_TYPE)
  })
})

describe('getFilePickerTypes', () => {
  // Each entry becomes its own filter in the native dialog, which opens on the
  // first. One entry per kind meant only PDFs were listed until the user found
  // and changed the filter. A single combined entry shows every supported file.
  it('offers a single combined entry, so the user is never asked to choose a file type', () => {
    const types = getFilePickerTypes()

    expect(types).toHaveLength(1)
    expect(types[0]?.description).toBe('Supported files')
  })

  it('lists every registered format in that one entry, not just the first kind', () => {
    const [entry] = getFilePickerTypes()

    for (const kind of RESOURCE_KINDS) {
      for (const format of kind.formats) {
        expect(entry?.accept[format.mimeType]).toEqual(format.extensions)
      }
    }
  })

  it('includes the formats that were missing when only PDF was offered', () => {
    const [entry] = getFilePickerTypes()

    expect(Object.keys(entry?.accept ?? {})).toEqual(
      expect.arrayContaining([
        'application/pdf',
        'text/markdown',
        DOCX,
        XLSX,
        PPTX,
      ]),
    )
  })

  it('maps each MIME type to its extensions, legacy Office formats included', () => {
    const [entry] = getFilePickerTypes()

    expect(entry?.accept['application/pdf']).toEqual(['.pdf'])
    expect(entry?.accept['text/markdown']).toEqual(['.md', '.markdown'])
    expect(entry?.accept[DOCX]).toEqual(['.docx'])
    expect(entry?.accept['application/msword']).toEqual(['.doc'])
  })

  it('offers no more MIME types than the registry has formats', () => {
    const [entry] = getFilePickerTypes()
    const formatCount = RESOURCE_KINDS.flatMap(kind => kind.formats).length

    expect(Object.keys(entry?.accept ?? {})).toHaveLength(formatCount)
  })

  it('returns fresh arrays, so a caller cannot mutate the registry', () => {
    const [first] = getFilePickerTypes()
    const accepted = first?.accept['application/pdf']

    if (Array.isArray(accepted)) {
      accepted.push('.mutated')
    }

    expect(getFilePickerTypes()[0]?.accept['application/pdf']).toEqual(['.pdf'])
  })
})

describe('getFileExtension', () => {
  it.each([
    ['application/pdf', '.pdf'],
    ['text/markdown', '.md'],
    [DOCX, '.docx'],
    ['application/msword', '.doc'],
    [XLSX, '.xlsx'],
    ['application/vnd.ms-excel', '.xls'],
    [PPTX, '.pptx'],
    ['application/vnd.ms-powerpoint', '.ppt'],
  ])('gives %s the extension %s', (mimeType, extension) => {
    expect(getFileExtension(mimeType)).toBe(extension)
  })

  it('normalizes the MIME type first', () => {
    expect(getFileExtension('Text/Markdown; charset=utf-8')).toBe('.md')
  })

  it('uses the first extension the registry lists for a format', () => {
    // `.markdown` is also accepted by the picker; `.md` is what a copy is named.
    expect(getFileExtension('text/markdown')).toBe('.md')
  })

  it('gives a type the registry does not list no extension', () => {
    expect(getFileExtension('application/x-something-new')).toBe('')
    expect(getFileExtension(UNKNOWN_MIME_TYPE)).toBe('')
    expect(getFileExtension('')).toBe('')
  })

  it('has an extension for every registered format', () => {
    for (const kind of RESOURCE_KINDS) {
      for (const format of kind.formats) {
        expect(getFileExtension(format.mimeType)).toBe(format.extensions[0])
      }
    }
  })
})
