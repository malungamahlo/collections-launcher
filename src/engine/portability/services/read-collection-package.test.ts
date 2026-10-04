import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { MAX_FILE_RESOURCE_SIZE_BYTES } from '@app/features/collections/model/file-resource.validation'
import {
  createTestFileResource,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import {
  PACKAGE_MAX_ARCHIVE_BYTES,
  PACKAGE_MAX_MANIFEST_BYTES,
  PACKAGE_MAX_TOTAL_BYTES,
  PACKAGE_MAX_ZIP_ENTRIES,
} from '../model/bundle.types'
import {
  createPackageFile,
  createPackageZip,
  createValidManifest,
  fileEntryFor,
  HANDBOOK_BYTES,
  sha256Of,
  zipToFile,
} from '../test/package.fixtures'
import {
  createBundleText,
  createEmptyTestCollection,
  createManifestObject,
} from '../test/portability.fixtures'
import { exportCollectionPackage } from './export-collection-package'
import { readImportedFile, type ReadImportedFileResult } from './read-collection-package'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** A manifest whose resources are exactly the given entries. */
function manifestWith(...resources: unknown[]): Record<string, unknown> {
  return createManifestObject({ collection: { resources } })
}

async function attachmentBytes(result: ReadImportedFileResult, path: string): Promise<Uint8Array> {
  if (result.status !== 'package') {
    throw new Error(`Expected a package, got "${result.status}".`)
  }

  return new Uint8Array(await (result.attachments.get(path) as Blob).arrayBuffer())
}

describe('readImportedFile: telling the formats apart', () => {
  it('reads a version 1 export, a JSON document, as before', async () => {
    const result = await readImportedFile(
      new File([createBundleText()], 'old.collectionLauncher'),
    )

    expect(result.status).toBe('bundle')
    if (result.status === 'bundle') {
      expect(result.bundle.collection.resources).toEqual([
        { name: 'GitHub', url: 'https://github.com/' },
      ])
    }
  })

  it('reads a package: its manifest and each attachment’s content', async () => {
    const result = await readImportedFile(await createPackageFile())

    expect(result.status).toBe('package')
    if (result.status === 'package') {
      expect(result.manifest.collection.name).toBe('Development')
      expect([...result.attachments.keys()]).toEqual(['attachments/0001.pdf'])
    }
    expect(await attachmentBytes(result, 'attachments/0001.pdf')).toEqual(HANDBOOK_BYTES)
  })

  it('goes by the file’s first bytes, not its name', async () => {
    const packageNamedTxt = new File([await (await createPackageFile()).arrayBuffer()], 'notes.txt')
    const jsonNamedZip = new File([createBundleText()], 'archive.zip')

    expect((await readImportedFile(packageNamedTxt)).status).toBe('package')
    expect((await readImportedFile(jsonNamedZip)).status).toBe('bundle')
  })

  it.each([
    ['not JSON and not a zip', 'hello there', 'malformed'],
    ['an empty file', '', 'malformed'],
    ['JSON of another format', createBundleText({ format: 'other' }), 'unsupported-format'],
    ['a version 1 document claiming a later version', createBundleText({ schemaVersion: 9 }), 'unsupported-version'],
  ])('rejects %s', async (_label, text, reason) => {
    expect(await readImportedFile(new File([text], 'x.collectionLauncher'))).toEqual({
      status: 'rejected',
      reason,
    })
  })
})

describe('readImportedFile: what an exported package round-trips', () => {
  it('reads back exactly what the exporter wrote', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 exported')
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])
    const collection = createEmptyTestCollection({
      name: 'Round trip',
      resources: [
        createTestWebsiteResource({ id: 's1', name: 'GitHub', url: 'https://github.com/' }),
        createTestFileResource({ id: 'f1', name: 'Handbook', mimeType: 'application/pdf' }),
        createTestFileResource({ id: 'f2', name: 'Contract', mimeType: DOCX }),
      ],
    })
    const exported = await exportCollectionPackage(collection, {
      fileContent: {
        load: id => Promise.resolve(new Blob([(id === 'f1' ? pdf : docx) as Uint8Array<ArrayBuffer>])),
      },
    })

    const result = await readImportedFile(exported)

    expect(result.status).toBe('package')
    expect(await attachmentBytes(result, 'attachments/0001.pdf')).toEqual(pdf)
    expect(await attachmentBytes(result, 'attachments/0002.docx')).toEqual(docx)
    if (result.status === 'package') {
      expect(result.manifest.collection.resources.map(entry => entry.name)).toEqual([
        'GitHub',
        'Handbook',
        'Contract',
      ])
      // Each attachment is given its declared type, for the viewers to go by.
      expect(result.attachments.get('attachments/0001.pdf')?.type).toBe('application/pdf')
    }
  })

  it('reads a package of websites only, with no attachments', async () => {
    const result = await readImportedFile(
      await createPackageFile({
        manifest: manifestWith({ type: 'website', name: 'A', url: 'https://a.example/' }),
        attachments: {},
      }),
    )

    expect(result.status === 'package' && result.attachments.size).toBe(0)
  })

  it('reads attachments that were deflated, too', async () => {
    const result = await readImportedFile(await createPackageFile({ compression: 'DEFLATE' }))

    expect(await attachmentBytes(result, 'attachments/0001.pdf')).toEqual(HANDBOOK_BYTES)
  })

  it('reports progress as each attachment is checked', async () => {
    const onProgress = vi.fn()

    await readImportedFile(await createPackageFile(), { onProgress })

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { filesRead: 0, totalFiles: 1 },
      { filesRead: 1, totalFiles: 1 },
    ])
  })

  it('never reads an entry the manifest does not mention', async () => {
    const zip = createPackageZip({
      extraEntries: {
        'attachments/9999.pdf': 'unlisted',
        'evil.exe': 'unlisted',
        '../outside.txt': 'unlisted',
      },
    })
    const result = await readImportedFile(await zipToFile(zip))

    expect(result.status).toBe('package')
    if (result.status === 'package') {
      expect([...result.attachments.keys()]).toEqual(['attachments/0001.pdf'])
    }
  })
})

describe('readImportedFile: a hostile or damaged package is rejected whole', () => {
  const rejectedAs = (reason: string) => ({ status: 'rejected', reason })

  it('a corrupted zip', async () => {
    const bytes = new Uint8Array(await (await createPackageFile()).arrayBuffer())
    // Keep the zip signature so it is read as a package, then wreck the rest.
    bytes.fill(0xff, 4)

    expect(await readImportedFile(new File([bytes], 'x.collectionLauncher'))).toEqual(
      rejectedAs('malformed'),
    )
  })

  it('a zip with no manifest', async () => {
    expect(await readImportedFile(await createPackageFile({ manifest: null }))).toEqual(
      rejectedAs('malformed'),
    )
  })

  it('a zip that is some other kind of file, such as a Word document', async () => {
    const zip = new JSZip()
    zip.file('word/document.xml', '<w:document/>')

    expect(await readImportedFile(await zipToFile(zip))).toEqual(rejectedAs('malformed'))
  })

  it('a manifest that is not JSON', async () => {
    expect(await readImportedFile(await createPackageFile({ manifest: 'not json' }))).toEqual(
      rejectedAs('malformed'),
    )
  })

  it('a manifest larger than a manifest may be', async () => {
    const huge = { ...createValidManifest(), padding: 'x'.repeat(PACKAGE_MAX_MANIFEST_BYTES + 1) }

    expect(await readImportedFile(await createPackageFile({ manifest: huge }))).toEqual(
      rejectedAs('malformed'),
    )
  })

  it('an unsupported schema version, or another format', async () => {
    expect(
      await readImportedFile(
        await createPackageFile({ manifest: createManifestObject({ schemaVersion: 3 }) }),
      ),
    ).toEqual(rejectedAs('unsupported-version'))
    expect(
      await readImportedFile(
        await createPackageFile({ manifest: createManifestObject({ format: 'other' }) }),
      ),
    ).toEqual(rejectedAs('unsupported-format'))
  })

  it.each([
    ['climbs out of the package', '../../secret.pdf'],
    ['is absolute', '/etc/passwd'],
    ['is a user’s file name', 'attachments/report.pdf'],
    ['uses a backslash', 'attachments\\0001.pdf'],
  ])('an attachment path that %s — and nothing at that path is read', async (_label, attachment) => {
    const file = await createPackageFile({
      manifest: manifestWith(fileEntryFor(HANDBOOK_BYTES, { attachment })),
      extraEntries: { [attachment]: HANDBOOK_BYTES },
    })

    expect(await readImportedFile(file)).toEqual(rejectedAs('malformed'))
  })

  it('two entries that name the same attachment', async () => {
    const file = await createPackageFile({
      manifest: manifestWith(
        fileEntryFor(HANDBOOK_BYTES, { name: 'One' }),
        fileEntryFor(HANDBOOK_BYTES, { name: 'Two' }),
      ),
    })

    expect(await readImportedFile(file)).toEqual(rejectedAs('malformed'))
  })

  it('an attachment the manifest names that is not in the zip', async () => {
    expect(await readImportedFile(await createPackageFile({ attachments: {} }))).toEqual(
      rejectedAs('damaged'),
    )
  })

  it('an attachment path that is a folder in the zip', async () => {
    const zip = createPackageZip({ attachments: {} })
    zip.folder('attachments/0001.pdf')

    expect(await readImportedFile(await zipToFile(zip))).toEqual(rejectedAs('damaged'))
  })

  it.each([
    ['smaller than', HANDBOOK_BYTES.byteLength - 1],
    ['larger than', HANDBOOK_BYTES.byteLength + 1],
  ])('a declared size %s the real one', async (_label, sizeBytes) => {
    const file = await createPackageFile({
      manifest: manifestWith(fileEntryFor(HANDBOOK_BYTES, { sizeBytes })),
    })

    expect(await readImportedFile(file)).toEqual(rejectedAs('damaged'))
  })

  it('a SHA-256 that is not the attachment’s', async () => {
    const file = await createPackageFile({
      manifest: manifestWith(fileEntryFor(HANDBOOK_BYTES, { sha256: 'b'.repeat(64) })),
    })

    expect(await readImportedFile(file)).toEqual(rejectedAs('damaged'))
  })

  it('an attachment swapped for another of the same size', async () => {
    const swapped = Uint8Array.from(HANDBOOK_BYTES)
    swapped[swapped.length - 1] = 0x21

    expect(
      await readImportedFile(
        await createPackageFile({ attachments: { 'attachments/0001.pdf': swapped } }),
      ),
    ).toEqual(rejectedAs('damaged'))
  })

  it('an HTML page declared as a PDF, even with the right size and hash', async () => {
    const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')
    const file = await createPackageFile({
      manifest: manifestWith(fileEntryFor(html)),
      attachments: { 'attachments/0001.pdf': html },
    })

    expect(await readImportedFile(file)).toEqual(rejectedAs('damaged'))
  })

  /**
   * Loads a package the way the reader will, lets a test change what the zip's
   * directory declares about its attachments, and counts how often each is
   * unpacked. Real attachments this large cannot be built in a test, and the
   * point is that the reader goes by the directory before unpacking anything.
   */
  async function readWithDeclaredSizes(
    options: Parameters<typeof createPackageZip>[0],
    declaredSizeBytes: number,
  ) {
    const loaded = await JSZip.loadAsync(
      await createPackageZip(options).generateAsync({ type: 'uint8array' }),
    )
    const unpack = vi.fn()

    for (const entry of Object.values(loaded.files)) {
      if (entry.name.startsWith('attachments/') && !entry.dir) {
        const internals = entry as unknown as {
          _data: { uncompressedSize: number }
          internalStream: unknown
        }
        internals._data.uncompressedSize = declaredSizeBytes
        internals.internalStream = unpack
      }
    }

    const spy = vi.spyOn(JSZip, 'loadAsync').mockResolvedValueOnce(loaded)
    const result = await readImportedFile(await zipToFile(createPackageZip()))
    spy.mockRestore()

    return { result, unpack }
  }

  it('an attachment larger than a file may be — without unpacking it', async () => {
    const sizeBytes = MAX_FILE_RESOURCE_SIZE_BYTES + 1
    const { result, unpack } = await readWithDeclaredSizes(
      { manifest: manifestWith(fileEntryFor(HANDBOOK_BYTES, { sizeBytes })) },
      sizeBytes,
    )

    expect(result).toEqual(rejectedAs('too-large'))
    expect(unpack).not.toHaveBeenCalled()
  })

  it('files that together are more than a package may hold — without unpacking them', async () => {
    const each = MAX_FILE_RESOURCE_SIZE_BYTES
    const count = Math.floor(PACKAGE_MAX_TOTAL_BYTES / each) + 1
    const paths = Array.from(
      { length: count },
      (_, index) => `attachments/${String(index + 1).padStart(4, '0')}.pdf`,
    )
    const { result, unpack } = await readWithDeclaredSizes(
      {
        manifest: manifestWith(
          ...paths.map((attachment, index) =>
            fileEntryFor(HANDBOOK_BYTES, { name: `File ${index}`, sizeBytes: each, attachment }),
          ),
        ),
        attachments: Object.fromEntries(paths.map(path => [path, HANDBOOK_BYTES])),
      },
      each,
    )

    expect(result).toEqual(rejectedAs('too-large'))
    expect(unpack).not.toHaveBeenCalled()
  })

  it('a zip bomb: an attachment that unpacks to far more than the zip declares', async () => {
    // 4 MB of zeros deflates to a few kilobytes. The manifest and the zip's
    // directory both claim it is the handbook's size.
    const bomb = new Uint8Array(4 * 1024 * 1024)
    const zip = createPackageZip({
      manifest: manifestWith(fileEntryFor(HANDBOOK_BYTES)),
      attachments: { 'attachments/0001.pdf': bomb },
      compression: 'DEFLATE',
    })
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }))
    const entry = loaded.file('attachments/0001.pdf') as unknown as {
      _data: { uncompressedSize: number }
    }
    entry._data.uncompressedSize = HANDBOOK_BYTES.byteLength
    const spy = vi.spyOn(JSZip, 'loadAsync').mockResolvedValueOnce(loaded)

    expect(await readImportedFile(await zipToFile(createPackageZip()))).toEqual(rejectedAs('damaged'))
    spy.mockRestore()
  })

  it('a zip stuffed with more entries than a package may have', async () => {
    const extraEntries = Object.fromEntries(
      Array.from({ length: PACKAGE_MAX_ZIP_ENTRIES + 1 }, (_, index) => [`junk/${index}`, '']),
    )

    expect(await readImportedFile(await createPackageFile({ extraEntries }))).toEqual(
      rejectedAs('malformed'),
    )
  })

  it('a file larger than any package may be — without reading it', async () => {
    const arrayBuffer = vi.fn()
    const giant = {
      size: PACKAGE_MAX_ARCHIVE_BYTES + 1,
      slice: vi.fn(),
      arrayBuffer,
      text: vi.fn(),
    } as unknown as Blob

    expect(await readImportedFile(giant)).toEqual(rejectedAs('too-large'))
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('checks even an entry whose name is invalid: integrity is about the package, not one entry', async () => {
    const file = await createPackageFile({
      manifest: manifestWith(fileEntryFor(HANDBOOK_BYTES, { name: '   ', sha256: sha256Of(new Uint8Array([1])) })),
    })

    expect(await readImportedFile(file)).toEqual(rejectedAs('damaged'))
  })
})
