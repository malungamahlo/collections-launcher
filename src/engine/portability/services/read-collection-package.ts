import { MAX_FILE_RESOURCE_SIZE_BYTES } from '@app/features/collections/model/file-resource.validation'
import {
  normalizeMimeType,
  UNKNOWN_MIME_TYPE,
} from '@app/features/collections/model/resource-kind-registry'
import {
  getDeclaredZipEntrySize,
  readZipEntryBytes,
} from '@app/shared/lib/zip-entry-size'
import {
  PACKAGE_MANIFEST_PATH,
  PACKAGE_MAX_ARCHIVE_BYTES,
  PACKAGE_MAX_MANIFEST_BYTES,
  PACKAGE_MAX_TOTAL_BYTES,
  PACKAGE_MAX_ZIP_ENTRIES,
  type CollectionBundle,
  type CollectionPackageManifest,
  type PackageFileEntry,
} from '../model/bundle.types'
import { looksLikeDeclaredType, SIGNATURE_SAMPLE_BYTES } from '../model/file-signature'
import {
  parseImportedBundleText,
  parsePackageManifestText,
} from '../validation/bundle.validation'

/** Why a picked file was not accepted for import. */
export type ImportRejection =
  /** Not a Collections Launcher export, or not one that makes sense. */
  | 'malformed'
  /** A document of some other format. */
  | 'unsupported-format'
  /** Written by a newer version than this one reads. */
  | 'unsupported-version'
  /** Larger than an import may be: the file, one of its files, or all of them together. */
  | 'too-large'
  /** A package whose contents do not match what its manifest says. */
  | 'damaged'

/** What reading a picked file found. */
export type ReadImportedFileResult =
  /** A version 1 export: a JSON document of websites. */
  | { readonly status: 'bundle'; readonly bundle: CollectionBundle }
  /** A package: the manifest, and each attachment's verified content by its path. */
  | {
      readonly status: 'package'
      readonly manifest: CollectionPackageManifest
      readonly attachments: ReadonlyMap<string, Blob>
    }
  | { readonly status: 'rejected'; readonly reason: ImportRejection }

/** How far reading a package has got, for showing progress. */
export interface ImportReadProgress {
  readonly filesRead: number
  readonly totalFiles: number
}

interface ReadImportedFileOptions {
  readonly onProgress?: (progress: ImportReadProgress) => void
}

/** The first bytes of every zip, and so of every package. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]

function rejected(reason: ImportRejection): ReadImportedFileResult {
  return { status: 'rejected', reason }
}

async function isZip(file: Blob): Promise<boolean> {
  const start = new Uint8Array(await file.slice(0, ZIP_SIGNATURE.length).arrayBuffer())

  return (
    start.length === ZIP_SIGNATURE.length &&
    ZIP_SIGNATURE.every((byte, index) => start[index] === byte)
  )
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Reads a package: a zip holding `manifest.json` and the exported files.
 *
 * Everything that can be checked **without unpacking a file** is checked
 * first — that the zip opens and is not stuffed with entries, that the
 * manifest is small and valid, and, from the zip's own directory, that every
 * attachment the manifest names is there at exactly the size it declares and
 * within the limits. Only then is each attachment unpacked, and its real
 * length, its SHA-256 and its first bytes are checked against the manifest.
 *
 * Any mismatch rejects the whole package: it means damage or tampering, and
 * a partly trusted package is not worth importing. Entries the manifest does
 * not name are never read.
 */
async function readPackage(
  file: Blob,
  onProgress: ReadImportedFileOptions['onProgress'],
): Promise<ReadImportedFileResult> {
  const { default: JSZip } = await import('jszip')
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>

  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    return rejected('malformed')
  }

  if (Object.keys(zip.files).length > PACKAGE_MAX_ZIP_ENTRIES) {
    return rejected('malformed')
  }

  const manifestEntry = zip.file(PACKAGE_MANIFEST_PATH)

  if (!manifestEntry) {
    return rejected('malformed')
  }

  if (getDeclaredZipEntrySize(manifestEntry) > PACKAGE_MAX_MANIFEST_BYTES) {
    return rejected('malformed')
  }

  let manifestText: string

  try {
    // The declared size is only a claim: unpacking stops at the limit too.
    manifestText = new TextDecoder().decode(
      await readZipEntryBytes(manifestEntry, PACKAGE_MAX_MANIFEST_BYTES),
    )
  } catch {
    return rejected('malformed')
  }

  const parsed = parsePackageManifestText(manifestText)

  if (parsed.status !== 'valid') {
    return rejected(parsed.status)
  }

  const fileEntries = parsed.manifest.collection.resources.filter(
    (entry): entry is PackageFileEntry => entry.type === 'file',
  )
  let totalBytes = 0

  // From the zip's directory only: nothing is unpacked in this loop.
  for (const entry of fileEntries) {
    const attachment = zip.file(entry.attachment)

    if (!attachment || attachment.dir) {
      return rejected('damaged')
    }

    if (getDeclaredZipEntrySize(attachment) !== entry.sizeBytes) {
      return rejected('damaged')
    }

    if (entry.sizeBytes > MAX_FILE_RESOURCE_SIZE_BYTES) {
      return rejected('too-large')
    }

    totalBytes += entry.sizeBytes

    if (totalBytes > PACKAGE_MAX_TOTAL_BYTES) {
      return rejected('too-large')
    }
  }

  const attachments = new Map<string, Blob>()

  onProgress?.({ filesRead: 0, totalFiles: fileEntries.length })

  for (const [index, entry] of fileEntries.entries()) {
    let bytes: Uint8Array<ArrayBuffer>

    try {
      // Stops as soon as more comes out than the manifest declared.
      bytes = await readZipEntryBytes(zip.file(entry.attachment) as object, entry.sizeBytes)
    } catch {
      return rejected('damaged')
    }

    const mimeType = normalizeMimeType(entry.mimeType) || UNKNOWN_MIME_TYPE

    if (
      bytes.byteLength !== entry.sizeBytes ||
      (await sha256Hex(bytes)) !== entry.sha256 ||
      !looksLikeDeclaredType(mimeType, bytes.subarray(0, SIGNATURE_SAMPLE_BYTES))
    ) {
      return rejected('damaged')
    }

    attachments.set(entry.attachment, new Blob([bytes], { type: mimeType }))
    onProgress?.({ filesRead: index + 1, totalFiles: fileEntries.length })
  }

  return { status: 'package', manifest: parsed.manifest, attachments }
}

/**
 * Reads a file picked for import, whichever kind of export it is. The two are
 * told apart by their first bytes, never by the file's name: a zip is a
 * package; anything else is read as the version 1 JSON document, by the same
 * code as before packages existed.
 *
 * Never throws for a bad file — every input maps to a result — and nothing
 * here touches the collections or the file store. The zip library is loaded
 * only when a package is read.
 */
export async function readImportedFile(
  file: Blob,
  { onProgress }: ReadImportedFileOptions = {},
): Promise<ReadImportedFileResult> {
  if (file.size > PACKAGE_MAX_ARCHIVE_BYTES) {
    return rejected('too-large')
  }

  if (await isZip(file)) {
    return readPackage(file, onProgress)
  }

  const parsed = parseImportedBundleText(await file.text())

  return parsed.status === 'valid'
    ? { status: 'bundle', bundle: parsed.bundle }
    : rejected(parsed.status)
}
