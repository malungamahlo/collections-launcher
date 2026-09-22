import type { ReactNode } from 'react'
import { FileViewer } from '@app/features/collections/components/file-viewer'
import { useCollectionsState } from '@app/features/collections/hooks/use-collections-state'
import { useFileViewer } from '@app/features/collections/hooks/use-file-viewer'
import { useSaveFileCopy } from '@app/features/collections/hooks/use-save-file-copy'
import { findFileResourceById } from '@app/features/collections/model/collection.queries'
import type { FileResource } from '@app/features/collections/model/collection.types'
import { readFileViewerResourceId } from '@app/features/collections/model/file-viewer-location'
import type { CollectionsRepository } from '@app/features/collections/storage/collections.repository'
import { ChromeLocalCollectionsRepository } from '@app/features/collections/storage/chrome-local-collections.repository'
import {
  BrowserFileContentAdapter,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import {
  BrowserFileDownloadAdapter,
  type FileDownloadAdapter,
} from '@app/platform/browser/file-download.adapter'
import { IndexedDbFileContentStore } from '@app/platform/browser/indexeddb-file-content.store'
import { useDocumentTitle } from '@app/shared/hooks/use-document-title'

const collectionsRepository = new ChromeLocalCollectionsRepository()
// Reads the same file store the dashboard writes to, in the same origin.
const fileContentAdapter = new BrowserFileContentAdapter(
  new IndexedDbFileContentStore(),
)
const fileDownloadAdapter = new BrowserFileDownloadAdapter()

interface AppProps {
  readonly repository?: CollectionsRepository
  readonly fileContent?: FileContentAdapter
  readonly fileDownload?: FileDownloadAdapter
  /** The page's query string; defaults to this page's own. */
  readonly search?: string
}

/** A short message in the middle of an otherwise empty page. */
function PageMessage({
  children,
  role = 'status',
}: {
  readonly children: ReactNode
  readonly role?: 'status' | 'alert'
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <p role={role} className="max-w-md text-center text-sm leading-6 text-muted-foreground">
        {children}
      </p>
    </main>
  )
}

interface FileViewerScreenProps {
  readonly resource: FileResource
  readonly fileContent: FileContentAdapter
  readonly fileDownload: FileDownloadAdapter
}

/** Connects the viewer to reading the file, saving a copy of it, and naming the tab. */
function FileViewerScreen({
  resource,
  fileContent,
  fileDownload,
}: FileViewerScreenProps) {
  const viewer = useFileViewer({ fileContent, resource })
  const saveCopy = useSaveFileCopy({ fileContent, fileDownload })

  useDocumentTitle(resource.name)

  return (
    <FileViewer
      resource={resource}
      state={viewer.state}
      saveError={saveCopy.error}
      onRetry={viewer.retry}
      onSave={() => void saveCopy.save(resource)}
    />
  )
}

/**
 * The page a file resource is viewed on. The dashboard navigates here for a
 * PDF or a Markdown file, passing the resource's id in the address; this looks
 * the resource up and shows it. Composition only — reading, rendering and
 * saving live in the feature.
 */
function App({
  repository = collectionsRepository,
  fileContent = fileContentAdapter,
  fileDownload = fileDownloadAdapter,
  search = window.location.search,
}: AppProps) {
  const resourceId = readFileViewerResourceId(search)
  const collections = useCollectionsState(repository)
  const resource = resourceId
    ? findFileResourceById(collections.state, resourceId)
    : undefined

  if (!resourceId) {
    return (
      <PageMessage>
        No file was chosen. Open one from your collections.
      </PageMessage>
    )
  }

  if (collections.status === 'loading') {
    return <PageMessage>Loading…</PageMessage>
  }

  if (collections.status === 'error') {
    return (
      <PageMessage role="alert">
        Your collections could not be loaded. Reload the page to try again.
      </PageMessage>
    )
  }

  if (!resource) {
    return (
      <PageMessage>This file is no longer in your collections.</PageMessage>
    )
  }

  return (
    <FileViewerScreen
      key={resource.id}
      resource={resource}
      fileContent={fileContent}
      fileDownload={fileDownload}
    />
  )
}

export default App
