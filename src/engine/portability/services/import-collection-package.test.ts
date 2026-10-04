import { describe, expect, it } from 'vitest'
import type { FactoryDependencies } from '@app/features/collections/model/collection.factory'
import {
  isFileResource,
  isWebsiteResource,
} from '@app/features/collections/model/resource.guards'
import {
  createTestCollection,
  createTestState,
} from '@app/features/collections/test/collection.fixtures'
import type {
  CollectionPackageManifest,
  PackageResourceEntry,
} from '../model/bundle.types'
import { TEST_SHA256 } from '../test/portability.fixtures'
import {
  buildPackageImportPreview,
  isImportPreviewFile,
  prepareImport,
  type ImportPreview,
} from './import-collection-bundle'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const PDF_CONTENT = new Blob(['%PDF-1.7 handbook'], { type: 'application/pdf' })
const DOCX_CONTENT = new Blob(['PK contract'], { type: DOCX })

const GITHUB: PackageResourceEntry = { type: 'website', name: 'GitHub', url: 'https://github.com/' }
const HANDBOOK: PackageResourceEntry = {
  type: 'file',
  name: 'Handbook',
  mimeType: 'application/pdf',
  sizeBytes: PDF_CONTENT.size,
  sha256: TEST_SHA256,
  attachment: 'attachments/0001.pdf',
}
const CONTRACT: PackageResourceEntry = {
  type: 'file',
  name: 'Contract',
  mimeType: DOCX,
  sizeBytes: DOCX_CONTENT.size,
  sha256: TEST_SHA256,
  attachment: 'attachments/0002.docx',
}

const ATTACHMENTS = new Map<string, Blob>([
  ['attachments/0001.pdf', PDF_CONTENT],
  ['attachments/0002.docx', DOCX_CONTENT],
])

function manifest(
  resources: readonly PackageResourceEntry[],
  collection: Partial<CollectionPackageManifest['collection']> = {},
): CollectionPackageManifest {
  return {
    format: 'collections-launcher',
    schemaVersion: 2,
    exportedAt: new Date(0).toISOString(),
    collection: { name: 'Study pack', ...collection, resources },
  }
}

/** Ids `id-1`, `id-2`, … in the order they are asked for, and a fixed clock. */
function countingDependencies(): FactoryDependencies {
  let next = 0

  return { generateId: () => `id-${(next += 1)}`, now: () => 5_000 }
}

describe('buildPackageImportPreview', () => {
  it('lists websites and files together, in the order they were exported', () => {
    const preview = buildPackageImportPreview(
      manifest([HANDBOOK, GITHUB, CONTRACT]),
      ATTACHMENTS,
      createTestState(),
    )

    expect(preview.resources).toEqual([
      { type: 'file', name: 'Handbook', mimeType: 'application/pdf', sizeBytes: PDF_CONTENT.size, content: PDF_CONTENT },
      { name: 'GitHub', url: 'https://github.com/' },
      { type: 'file', name: 'Contract', mimeType: DOCX, sizeBytes: DOCX_CONTENT.size, content: DOCX_CONTENT },
    ])
    expect(preview.skippedDuplicateCount).toBe(0)
    expect(preview.skippedInvalidCount).toBe(0)
  })

  it('carries the collection’s name, description, icon and colour', () => {
    const preview = buildPackageImportPreview(
      manifest([], { description: 'For the exam', icon: 'book', color: '#ff0000' }),
      new Map(),
      createTestState(),
    )

    expect(preview).toMatchObject({
      suggestedName: 'Study pack',
      description: 'For the exam',
      icon: 'book',
      color: '#ff0000',
      hasNameConflict: false,
    })
  })

  it('flags a name an existing collection already has', () => {
    const state = createTestState({ collections: [createTestCollection({ name: 'study PACK' })] })

    expect(buildPackageImportPreview(manifest([]), new Map(), state).hasNameConflict).toBe(true)
  })

  it('skips and counts an entry with an invalid name or URL', () => {
    const preview = buildPackageImportPreview(
      manifest([
        { type: 'website', name: 'Bad', url: 'javascript:alert(1)' },
        { ...HANDBOOK, name: '   ' },
        CONTRACT,
      ]),
      ATTACHMENTS,
      createTestState(),
    )

    expect(preview.resources.map(resource => resource.name)).toEqual(['Contract'])
    expect(preview.skippedInvalidCount).toBe(2)
  })

  it('skips a resource that repeats a name, whatever its kind — the first wins', () => {
    const preview = buildPackageImportPreview(
      manifest([
        HANDBOOK,
        { type: 'website', name: 'handbook', url: 'https://handbook.example/' },
        { ...CONTRACT, name: 'HANDBOOK' },
        GITHUB,
        { type: 'website', name: 'GitHub again', url: 'https://github.com/' },
      ]),
      ATTACHMENTS,
      createTestState(),
    )

    expect(preview.resources.map(resource => resource.name)).toEqual(['Handbook', 'GitHub'])
    expect(preview.skippedDuplicateCount).toBe(3)
  })

  it('refuses to build a preview for a file whose content was never read', () => {
    expect(() =>
      buildPackageImportPreview(manifest([HANDBOOK]), new Map(), createTestState()),
    ).toThrow('attachments/0001.pdf')
  })
})

describe('prepareImport', () => {
  function previewOf(resources: readonly PackageResourceEntry[]): ImportPreview {
    return buildPackageImportPreview(manifest(resources), ATTACHMENTS, createTestState())
  }

  it('creates the collection with every resource in order, and pairs each file’s content with its new id', () => {
    const prepared = prepareImport(
      createTestState(),
      previewOf([GITHUB, HANDBOOK, CONTRACT]),
      'Study pack',
      countingDependencies(),
    )
    const [collection] = prepared.state.collections

    expect(collection?.name).toBe('Study pack')
    expect(collection?.resources.map(resource => [resource.type, resource.name])).toEqual([
      ['website', 'GitHub'],
      ['file', 'Handbook'],
      ['file', 'Contract'],
    ])
    const files = collection?.resources.filter(isFileResource) ?? []
    expect(files.map(file => [file.mimeType, file.sizeBytes])).toEqual([
      ['application/pdf', PDF_CONTENT.size],
      [DOCX, DOCX_CONTENT.size],
    ])
    expect(prepared.fileContents).toEqual([
      { resourceId: files[0]?.id, content: PDF_CONTENT },
      { resourceId: files[1]?.id, content: DOCX_CONTENT },
    ])
  })

  it('gives every imported resource a fresh id: nothing travels from the file', () => {
    const prepared = prepareImport(
      createTestState(),
      previewOf([GITHUB, HANDBOOK]),
      'Study pack',
      countingDependencies(),
    )
    const [collection] = prepared.state.collections
    const ids = [collection?.id, ...(collection?.resources.map(resource => resource.id) ?? [])]

    expect(new Set(ids).size).toBe(3)
    expect(ids.every(id => id?.startsWith('id-'))).toBe(true)
  })

  it('has nothing to store for a preview of websites only', () => {
    const prepared = prepareImport(createTestState(), previewOf([GITHUB]), 'Sites')

    expect(prepared.fileContents).toEqual([])
    expect(prepared.state.collections[0]?.resources.every(isWebsiteResource)).toBe(true)
  })

  it('touches nothing: the state it was given is unchanged', () => {
    const state = createTestState()

    prepareImport(state, previewOf([HANDBOOK]), 'Study pack')

    expect(state.collections).toEqual([])
  })

  it('throws, having prepared nothing, when the name is already taken', () => {
    const state = createTestState({ collections: [createTestCollection({ name: 'Study pack' })] })

    expect(() => prepareImport(state, previewOf([HANDBOOK]), 'Study pack')).toThrow()
  })
})

describe('isImportPreviewFile', () => {
  it('tells a file from a website', () => {
    const preview = buildPackageImportPreview(
      manifest([GITHUB, HANDBOOK]),
      ATTACHMENTS,
      createTestState(),
    )

    expect(preview.resources.map(isImportPreviewFile)).toEqual([false, true])
  })
})
