import type { Collection } from '@app/features/collections/model/collection.types'
import { MAX_FILE_RESOURCE_SIZE_BYTES } from '@app/features/collections/model/file-resource.validation'
import {
  FileContentError,
  type FileContentAdapter,
  type FileContentErrorCode,
} from '@app/platform/browser/file-content.adapter'
import {
  collectionToPackageManifest,
  planPackageAttachments,
  type AttachmentFacts,
} from '../model/bundle.mapper'
import { PACKAGE_MANIFEST_PATH, PACKAGE_MAX_TOTAL_BYTES } from '../model/bundle.types'

/** Why a collection could not be exported. */
export type ExportPackageFailure =
  /** One of its files could not be read; `fileErrorCode` says why. */
  | {
      readonly code: 'FILE_UNREADABLE'
      readonly resourceName: string
      readonly fileErrorCode: FileContentErrorCode
    }
  /** One of its files is larger than a package may carry. */
  | {
      readonly code: 'FILE_TOO_LARGE'
      readonly resourceName: string
      readonly sizeBytes: number
    }
  /** Its files together are larger than a package may hold. */
  | { readonly code: 'PACKAGE_TOO_LARGE'; readonly totalBytes: number }

/**
 * A predictable reason an export stopped. An export is all or nothing: when
 * this is thrown, no package was built.
 */
export class ExportPackageError extends Error {
  constructor(
    readonly failure: ExportPackageFailure,
    options?: { readonly cause?: unknown },
  ) {
    super(`The collection could not be exported (${failure.code}).`, options)
    this.name = 'ExportPackageError'
  }
}

/** How far an export has got, for showing progress. */
export interface ExportProgress {
  readonly filesRead: number
  readonly totalFiles: number
}

interface ExportCollectionPackageOptions {
  readonly fileContent: Pick<FileContentAdapter, 'load'>
  readonly now?: () => number
  readonly onProgress?: (progress: ExportProgress) => void
}

/** The type the exported file is given. Its name, not this, is what marks it as a collection. */
const PACKAGE_MIME_TYPE = 'application/octet-stream'

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Builds the `.collectionLauncher` package for a collection: a zip holding
 * `manifest.json` (every resource, websites and files alike) and one
 * attachment per file resource — the file's actual bytes, so the collection
 * can be opened on another computer.
 *
 * Every file is **located first**, before any is read. Locating one is what
 * asks the browser for access that has lapsed, and the browser only shows
 * that prompt for a short while after a click; so all the prompts come
 * straight away, and a missing or refused file stops the export before time
 * is spent reading the others. The sizes are known at that point too, so a
 * collection over the limits is refused without reading anything.
 *
 * The zip library is loaded only when an export runs.
 *
 * @throws ExportPackageError when a file cannot be read or a limit is exceeded.
 */
export async function exportCollectionPackage(
  collection: Collection,
  { fileContent, now, onProgress }: ExportCollectionPackageOptions,
): Promise<Blob> {
  const attachments = planPackageAttachments(collection)
  const located: Blob[] = []

  for (const attachment of attachments) {
    try {
      located.push(await fileContent.load(attachment.resourceId))
    } catch (error) {
      throw new ExportPackageError(
        {
          code: 'FILE_UNREADABLE',
          resourceName: attachment.name,
          fileErrorCode: error instanceof FileContentError ? error.code : 'UNAVAILABLE',
        },
        { cause: error },
      )
    }
  }

  located.forEach((file, index) => {
    if (file.size > MAX_FILE_RESOURCE_SIZE_BYTES) {
      throw new ExportPackageError({
        code: 'FILE_TOO_LARGE',
        resourceName: attachments[index]?.name ?? '',
        sizeBytes: file.size,
      })
    }
  })

  const totalBytes = located.reduce((total, file) => total + file.size, 0)

  if (totalBytes > PACKAGE_MAX_TOTAL_BYTES) {
    throw new ExportPackageError({ code: 'PACKAGE_TOO_LARGE', totalBytes })
  }

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const facts = new Map<string, AttachmentFacts>()

  onProgress?.({ filesRead: 0, totalFiles: attachments.length })

  for (const [index, attachment] of attachments.entries()) {
    let bytes: ArrayBuffer

    try {
      bytes = await (located[index] as Blob).arrayBuffer()
    } catch (error) {
      // The file was there a moment ago: it was moved, or the drive went away.
      throw new ExportPackageError(
        { code: 'FILE_UNREADABLE', resourceName: attachment.name, fileErrorCode: 'UNAVAILABLE' },
        { cause: error },
      )
    }

    facts.set(attachment.path, {
      sizeBytes: bytes.byteLength,
      sha256: await sha256Hex(bytes),
    })
    // Stored, not deflated: PDFs, Office files and images are already
    // compressed, so deflating them costs time for almost nothing.
    zip.file(attachment.path, bytes, { compression: 'STORE' })
    onProgress?.({ filesRead: index + 1, totalFiles: attachments.length })
  }

  zip.file(
    PACKAGE_MANIFEST_PATH,
    JSON.stringify(collectionToPackageManifest(collection, facts, now), null, 2),
    { compression: 'DEFLATE' },
  )

  const archive = await zip.generateAsync({ type: 'uint8array' })

  return new Blob([archive as Uint8Array<ArrayBuffer>], { type: PACKAGE_MIME_TYPE })
}
