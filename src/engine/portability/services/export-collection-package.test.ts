import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { MAX_FILE_RESOURCE_SIZE_BYTES } from '@app/features/collections/model/file-resource.validation'
import {
  createTestFileResource,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import { PACKAGE_MAX_TOTAL_BYTES } from '../model/bundle.types'
import {
  createEmptyTestCollection,
  createManyResourcesTestCollection,
} from '../test/portability.fixtures'
import { parsePackageManifestText } from '../validation/bundle.validation'
import {
  ExportPackageError,
  exportCollectionPackage,
  type ExportPackageFailure,
} from './export-collection-package'

const fixedNow = () => 2_000

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const GITHUB = createTestWebsiteResource({ id: 'site-1', name: 'GitHub', url: 'https://github.com/' })
const HANDBOOK = createTestFileResource({ id: 'file-1', name: 'Handbook', mimeType: 'application/pdf' })
const CONTRACT = createTestFileResource({ id: 'file-2', name: 'Contract', mimeType: DOCX })

const MIXED = createEmptyTestCollection({
  name: 'Mixed',
  description: 'Everything',
  resources: [GITHUB, HANDBOOK, CONTRACT],
})

const HANDBOOK_BYTES = new TextEncoder().encode('%PDF-1.7 the handbook')
// Every byte value, so a text round trip would corrupt it.
const CONTRACT_BYTES = Uint8Array.from({ length: 512 }, (_, index) => index % 256)

const CONTENT: Readonly<Record<string, Uint8Array>> = {
  'file-1': HANDBOOK_BYTES,
  'file-2': CONTRACT_BYTES,
}

function createFileContent(
  load: FileContentAdapter['load'] = id =>
    Promise.resolve(new Blob([CONTENT[id] as Uint8Array<ArrayBuffer>])),
) {
  return { load: vi.fn(load) }
}

/** A stand-in for a file of a given size, without allocating it. */
function fileOfSize(size: number): Blob {
  return { size, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) } as unknown as Blob
}

async function unzip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer())
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Runs an export expected to stop, and returns why it did. */
async function failureOf(run: Promise<Blob>): Promise<ExportPackageFailure> {
  try {
    await run
  } catch (error) {
    if (error instanceof ExportPackageError) {
      return error.failure
    }

    throw error
  }

  throw new Error('The export was expected to stop, but it produced a package.')
}

describe('exportCollectionPackage', () => {
  it('packs a manifest and one attachment per file, and nothing else', async () => {
    const zip = await unzip(
      await exportCollectionPackage(MIXED, { fileContent: createFileContent(), now: fixedNow }),
    )

    expect(Object.keys(zip.files).sort()).toEqual([
      'attachments/',
      'attachments/0001.pdf',
      'attachments/0002.docx',
      'manifest.json',
    ])
  })

  it('carries each file byte for byte', async () => {
    const zip = await unzip(
      await exportCollectionPackage(MIXED, { fileContent: createFileContent(), now: fixedNow }),
    )

    expect(await zip.file('attachments/0001.pdf')?.async('uint8array')).toEqual(HANDBOOK_BYTES)
    expect(await zip.file('attachments/0002.docx')?.async('uint8array')).toEqual(CONTRACT_BYTES)
  })

  it('writes a manifest listing every resource in order, with each file’s real size and SHA-256', async () => {
    const zip = await unzip(
      await exportCollectionPackage(MIXED, { fileContent: createFileContent(), now: fixedNow }),
    )
    const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '')

    expect(manifest).toEqual({
      format: 'collections-launcher',
      schemaVersion: 2,
      exportedAt: new Date(2_000).toISOString(),
      collection: {
        name: 'Mixed',
        description: 'Everything',
        resources: [
          { type: 'website', name: 'GitHub', url: 'https://github.com/' },
          {
            type: 'file',
            name: 'Handbook',
            mimeType: 'application/pdf',
            sizeBytes: HANDBOOK_BYTES.byteLength,
            sha256: sha256(HANDBOOK_BYTES),
            attachment: 'attachments/0001.pdf',
          },
          {
            type: 'file',
            name: 'Contract',
            mimeType: DOCX,
            sizeBytes: CONTRACT_BYTES.byteLength,
            sha256: sha256(CONTRACT_BYTES),
            attachment: 'attachments/0002.docx',
          },
        ],
      },
    })
  })

  it('writes a manifest the importer’s own validation accepts', async () => {
    const zip = await unzip(
      await exportCollectionPackage(MIXED, { fileContent: createFileContent(), now: fixedNow }),
    )

    expect(
      parsePackageManifestText((await zip.file('manifest.json')?.async('string')) ?? '').status,
    ).toBe('valid')
  })

  it('still produces a package for a collection with no files', async () => {
    const fileContent = createFileContent()
    const zip = await unzip(
      await exportCollectionPackage(createManyResourcesTestCollection(), { fileContent, now: fixedNow }),
    )

    expect(Object.keys(zip.files)).toEqual(['manifest.json'])
    expect(fileContent.load).not.toHaveBeenCalled()
  })

  it('stores attachments uncompressed and deflates the manifest', async () => {
    const zip = await unzip(
      await exportCollectionPackage(MIXED, { fileContent: createFileContent(), now: fixedNow }),
    )
    const compression = (path: string) =>
      (zip.file(path) as unknown as { _data: { compression: { magic: string } } })._data
        .compression.magic

    // In a zip, method 0 is "stored" and method 8 is "deflated".
    expect(compression('attachments/0001.pdf')).toBe('\x00\x00')
    expect(compression('manifest.json')).toBe('\x08\x00')
  })

  it('reports progress as each file is read', async () => {
    const onProgress = vi.fn()

    await exportCollectionPackage(MIXED, { fileContent: createFileContent(), onProgress })

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { filesRead: 0, totalFiles: 2 },
      { filesRead: 1, totalFiles: 2 },
      { filesRead: 2, totalFiles: 2 },
    ])
  })

  it('locates every file before reading any, so the browser’s prompts all come at once', async () => {
    const events: string[] = []
    const fileContent = createFileContent(id => {
      events.push(`locate ${id}`)

      return Promise.resolve({
        size: 1,
        arrayBuffer: () => {
          events.push(`read ${id}`)

          return Promise.resolve(new ArrayBuffer(1))
        },
      } as unknown as Blob)
    })

    await exportCollectionPackage(MIXED, { fileContent })

    expect(events).toEqual(['locate file-1', 'locate file-2', 'read file-1', 'read file-2'])
  })

  describe('stops, with no package, when', () => {
    it.each([['NOT_FOUND' as const], ['PERMISSION_DENIED' as const], ['UNAVAILABLE' as const]])(
      'a file cannot be read (%s), naming it',
      async code => {
        const fileContent = createFileContent(id =>
          id === 'file-2'
            ? Promise.reject(new FileContentError(code, 'no'))
            : Promise.resolve(new Blob(['ok'])),
        )

        expect(await failureOf(exportCollectionPackage(MIXED, { fileContent }))).toEqual({
          code: 'FILE_UNREADABLE',
          resourceName: 'Contract',
          fileErrorCode: code,
        })
      },
    )

    it('a file fails in a way nobody planned for', async () => {
      const fileContent = createFileContent(() => Promise.reject(new Error('disk on fire')))

      expect(await failureOf(exportCollectionPackage(MIXED, { fileContent }))).toEqual({
        code: 'FILE_UNREADABLE',
        resourceName: 'Handbook',
        fileErrorCode: 'UNAVAILABLE',
      })
    })

    it('a file disappears between being located and being read', async () => {
      const fileContent = createFileContent(() =>
        Promise.resolve({
          size: 1,
          arrayBuffer: () => Promise.reject(new DOMException('gone', 'NotReadableError')),
        } as unknown as Blob),
      )

      expect(await failureOf(exportCollectionPackage(MIXED, { fileContent }))).toMatchObject({
        code: 'FILE_UNREADABLE',
        resourceName: 'Handbook',
      })
    })

    it('a file is larger than a package may carry — before reading anything', async () => {
      const read = vi.fn(() => Promise.resolve(new ArrayBuffer(0)))
      const fileContent = createFileContent(id =>
        Promise.resolve(
          id === 'file-2'
            ? ({ size: MAX_FILE_RESOURCE_SIZE_BYTES + 1, arrayBuffer: read } as unknown as Blob)
            : ({ size: 1, arrayBuffer: read } as unknown as Blob),
        ),
      )

      expect(await failureOf(exportCollectionPackage(MIXED, { fileContent }))).toEqual({
        code: 'FILE_TOO_LARGE',
        resourceName: 'Contract',
        sizeBytes: MAX_FILE_RESOURCE_SIZE_BYTES + 1,
      })
      expect(read).not.toHaveBeenCalled()
    })

    it('the files together are more than a package may hold', async () => {
      const files = Array.from({ length: 6 }, (_, index) =>
        createTestFileResource({ id: `big-${index}`, name: `Big ${index}` }),
      )
      const each = MAX_FILE_RESOURCE_SIZE_BYTES - 1
      const fileContent = createFileContent(() => Promise.resolve(fileOfSize(each)))

      expect(
        await failureOf(
          exportCollectionPackage(createEmptyTestCollection({ resources: files }), { fileContent }),
        ),
      ).toEqual({ code: 'PACKAGE_TOO_LARGE', totalBytes: each * 6 })
      expect(each * 6).toBeGreaterThan(PACKAGE_MAX_TOTAL_BYTES)
    })
  })

  it('accepts a file exactly at the per-file limit', async () => {
    const file = createTestFileResource({ id: 'edge', name: 'Edge' })
    const fileContent = createFileContent(() =>
      Promise.resolve(fileOfSize(MAX_FILE_RESOURCE_SIZE_BYTES)),
    )

    await expect(
      exportCollectionPackage(createEmptyTestCollection({ resources: [file] }), { fileContent }),
    ).resolves.toBeInstanceOf(Blob)
  })
})
