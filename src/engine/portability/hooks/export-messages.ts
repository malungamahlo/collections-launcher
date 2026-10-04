import { MAX_FILE_RESOURCE_SIZE_BYTES } from '@app/features/collections/model/file-resource.validation'
import type { FileContentErrorCode } from '@app/platform/browser/file-content.adapter'
import { formatFileSize } from '@app/shared/lib/format-file-size'
import { PACKAGE_MAX_TOTAL_BYTES } from '../model/bundle.types'
import type {
  ExportPackageFailure,
  ExportProgress,
} from '../services/export-collection-package'

/** Why one file stopped the export, and what would let it through. */
function describeUnreadableFile(
  resourceName: string,
  code: FileContentErrorCode,
): string {
  switch (code) {
    case 'NOT_FOUND':
      return `"${resourceName}" could not be found. It may have been moved, renamed, or deleted. Remove it from the collection, or add it again, then export.`
    case 'PERMISSION_DENIED':
      return `access to "${resourceName}" was not granted. Export again and allow access when the browser asks.`
    case 'UNAVAILABLE':
      return `"${resourceName}" could not be read. Try again.`
  }
}

/**
 * What to tell the user when an export stopped. An export carries every
 * file or it is not made, so each message says the collection was not
 * exported, which file or limit stopped it, and what would let it through.
 */
export function describeExportFailure(
  collectionName: string,
  failure: ExportPackageFailure,
): string {
  const notExported = `"${collectionName}" was not exported`

  switch (failure.code) {
    case 'FILE_UNREADABLE':
      return `${notExported}: ${describeUnreadableFile(failure.resourceName, failure.fileErrorCode)}`
    case 'FILE_TOO_LARGE':
      return `${notExported}: "${failure.resourceName}" is ${formatFileSize(failure.sizeBytes)}, and a file in an export can be at most ${formatFileSize(MAX_FILE_RESOURCE_SIZE_BYTES)}.`
    case 'PACKAGE_TOO_LARGE':
      return `${notExported}: its files add up to ${formatFileSize(failure.totalBytes)}, and an export can hold at most ${formatFileSize(PACKAGE_MAX_TOTAL_BYTES)}.`
  }
}

/** What to show while an export is being built. */
export function describeExportProgress(
  collectionName: string,
  progress: ExportProgress | undefined,
): string {
  if (!progress || progress.totalFiles === 0) {
    return `Exporting "${collectionName}"…`
  }

  return `Exporting "${collectionName}"… ${progress.filesRead} of ${progress.totalFiles} ${
    progress.totalFiles === 1 ? 'file' : 'files'
  }`
}
