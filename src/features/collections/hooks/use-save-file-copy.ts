import { useState } from 'react'
import {
  FileContentError,
  type FileContentAdapter,
  type FileContentErrorCode,
} from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import type { FileResource } from '../model/collection.types'
import { getFileResourceFileName } from '../model/file-name'
import { describeFileSaveFailure } from './file-read-messages'

interface UseSaveFileCopyOptions {
  readonly fileContent: FileContentAdapter
  readonly fileDownload: FileDownloadAdapter
}

/**
 * Lets the user keep a copy of a file resource. This is the *only* way a file
 * resource ever becomes a second file on disk, and only because the user asked:
 * an ordinary, visible browser download, named after the resource with the
 * extension its type calls for.
 *
 * Call `save` straight from a click. A failure is reported as `error` (a
 * message for the user), and cleared by the next attempt or by `clearError`.
 */
export function useSaveFileCopy({ fileContent, fileDownload }: UseSaveFileCopyOptions) {
  const [error, setError] = useState<string>()

  async function save(resource: FileResource): Promise<void> {
    setError(undefined)

    try {
      const content = await fileContent.load(resource.id)

      fileDownload.download(getFileResourceFileName(resource), content)
    } catch (thrown) {
      const code: FileContentErrorCode =
        thrown instanceof FileContentError ? thrown.code : 'UNAVAILABLE'

      if (!(thrown instanceof FileContentError)) {
        console.error(`Could not save a copy of file resource ${resource.id}`, thrown)
      }

      setError(describeFileSaveFailure(resource.name, code))
    }
  }

  return { save, error, clearError: () => setError(undefined) }
}
