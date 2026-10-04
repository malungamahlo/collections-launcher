import { useRef, useState } from 'react'
import type { Collection } from '@app/features/collections/model/collection.types'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import type { FileDownloadAdapter } from '@app/platform/browser/file-download.adapter'
import { bundleFileName } from '../model/bundle-file'
import {
  ExportPackageError,
  exportCollectionPackage,
  type ExportProgress,
} from '../services/export-collection-package'
import { describeExportFailure, describeExportProgress } from './export-messages'

/** How an export is going. */
type ExportState =
  | { readonly status: 'idle' }
  /** Files are being read and the package built. */
  | {
      readonly status: 'working'
      readonly collectionName: string
      readonly progress?: ExportProgress
    }
  | { readonly status: 'failed'; readonly message: string }

/** A short message about an export, shown over the dashboard. */
export interface ExportNotice {
  readonly tone: 'info' | 'error'
  readonly message: string
}

interface UseExportCollectionOptions {
  readonly fileDownload: FileDownloadAdapter
  readonly fileContent: Pick<FileContentAdapter, 'load'>
}

/**
 * Exports a collection as a `.collectionLauncher` package — every resource,
 * with each file resource's content inside — and hands it to the browser as an
 * ordinary download.
 *
 * `exportCollection` must be called straight from a click: reading a file the
 * browser no longer has access to shows a permission prompt, and the browser
 * only shows that for a click.
 *
 * An export carries everything or is not made. If a file cannot be read, or
 * the collection is over the size limits, nothing is downloaded and `notice`
 * says which file or limit stopped it. While it runs, `notice` reports
 * progress; when it succeeds there is no notice — the browser's own download
 * is what tells the user.
 */
export function useExportCollection({
  fileDownload,
  fileContent,
}: UseExportCollectionOptions) {
  const [state, setState] = useState<ExportState>({ status: 'idle' })
  // One export at a time: a second click while one is running is ignored.
  const isRunningRef = useRef(false)

  async function exportCollection(collection: Collection): Promise<void> {
    if (isRunningRef.current) {
      return
    }

    isRunningRef.current = true
    setState({ status: 'working', collectionName: collection.name })

    try {
      const contents = await exportCollectionPackage(collection, {
        fileContent,
        onProgress: progress =>
          setState({ status: 'working', collectionName: collection.name, progress }),
      })

      fileDownload.download(bundleFileName(collection.name), contents)
      setState({ status: 'idle' })
    } catch (error) {
      if (error instanceof ExportPackageError) {
        setState({
          status: 'failed',
          message: describeExportFailure(collection.name, error.failure),
        })
      } else {
        console.error('Could not export collection', error)
        setState({
          status: 'failed',
          message: `"${collection.name}" could not be exported. Try again.`,
        })
      }
    } finally {
      isRunningRef.current = false
    }
  }

  function dismissNotice(): void {
    setState(current => (current.status === 'failed' ? { status: 'idle' } : current))
  }

  function describeNotice(): ExportNotice | undefined {
    switch (state.status) {
      case 'idle':
        return undefined
      case 'working':
        return {
          tone: 'info',
          message: describeExportProgress(state.collectionName, state.progress),
        }
      case 'failed':
        return { tone: 'error', message: state.message }
    }
  }

  return { exportCollection, notice: describeNotice(), dismissNotice }
}
