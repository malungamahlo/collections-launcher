import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { createManifestFileEntry, createManifestObject } from './portability.fixtures'

/**
 * Builds real `.collectionLauncher` packages in memory for the import tests,
 * with every part replaceable — so a test can make a package that is valid,
 * or wrong in exactly one way, and say which.
 */

/** The bytes of the "PDF" the default package carries. */
export const HANDBOOK_BYTES = new TextEncoder().encode('%PDF-1.7 the handbook')

/** SHA-256 as a manifest writes it. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** A manifest file entry that correctly describes the given bytes. */
export function fileEntryFor(
  bytes: Uint8Array,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return createManifestFileEntry({
    sizeBytes: bytes.byteLength,
    sha256: sha256Of(bytes),
    ...overrides,
  })
}

export interface TestPackageOptions {
  /**
   * The manifest: an object (serialized as JSON), raw text, or `null` to
   * leave `manifest.json` out. Defaults to one website and the handbook.
   */
  readonly manifest?: Record<string, unknown> | string | null
  /** The attachments, by path. Defaults to the handbook at `attachments/0001.pdf`. */
  readonly attachments?: Readonly<Record<string, Uint8Array>>
  /** Extra entries the manifest does not mention. */
  readonly extraEntries?: Readonly<Record<string, Uint8Array | string>>
  /** How attachments are stored. The exporter uses `STORE`. */
  readonly compression?: 'STORE' | 'DEFLATE'
}

/** The manifest of the default package: a website and the handbook, correctly described. */
export function createValidManifest(): Record<string, unknown> {
  return createManifestObject({
    collection: {
      resources: [
        { type: 'website', name: 'GitHub', url: 'https://github.com/' },
        fileEntryFor(HANDBOOK_BYTES),
      ],
    },
  })
}

/** Builds a package's zip, for a test that wants to change it further before reading it. */
export function createPackageZip({
  manifest = createValidManifest(),
  attachments = { 'attachments/0001.pdf': HANDBOOK_BYTES },
  extraEntries = {},
  compression = 'STORE',
}: TestPackageOptions = {}): JSZip {
  const zip = new JSZip()

  if (manifest !== null) {
    zip.file(
      'manifest.json',
      typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
      { compression: 'DEFLATE' },
    )
  }

  for (const [path, bytes] of Object.entries(attachments)) {
    zip.file(path, bytes, { compression })
  }

  for (const [path, contents] of Object.entries(extraEntries)) {
    zip.file(path, contents)
  }

  return zip
}

/** Builds a package as the file a user would pick. */
export async function createPackageFile(options?: TestPackageOptions): Promise<File> {
  return zipToFile(createPackageZip(options))
}

/** Turns a zip into the file a user would pick. */
export async function zipToFile(zip: JSZip): Promise<File> {
  const bytes = await zip.generateAsync({ type: 'uint8array' })

  return new File([bytes as Uint8Array<ArrayBuffer>], 'Development.collectionLauncher')
}
