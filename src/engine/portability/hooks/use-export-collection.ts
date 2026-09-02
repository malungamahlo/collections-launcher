import { useState } from 'react'
import type { Collection } from '@app/features/collections/model/collection.types'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import { bundleFileName } from '../model/bundle-file'
import { serializeCollectionBundle } from '../services/export-collection-bundle'

/** Triggers an immediate download of a collection's export bundle. */
export function useExportCollection(downloadAdapter: FileDownloadAdapter) {
  const [error, setError] = useState<string>()

  function exportCollection(collection: Collection): void {
    try {
      const contents = serializeCollectionBundle(collection)
      downloadAdapter.download(bundleFileName(collection.name), contents)
      setError(undefined)
    } catch (cause) {
      console.error('Could not export collection', cause)
      setError('The collection could not be exported. Try again.')
    }
  }

  return { exportCollection, error }
}
