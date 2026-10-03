import type { ReactNode } from 'react'
import { FileViewer } from '@app/features/collections/components/file-viewer'
import { useCollectionsState } from '@app/features/collections/hooks/use-collections-state'
import { useFileViewer } from '@app/features/collections/hooks/use-file-viewer'
import { findFileResourceById } from '@app/features/collections/model/collection.queries'
import type { FileResource } from '@app/features/collections/model/collection.types'
import {
  readFileDocumentUnavailable,
  readFileViewerResourceId,
} from '@app/features/collections/model/file-viewer-location'
import type { CollectionsRepository } from '@app/features/collections/storage/collections.repository'
import { ChromeLocalCollectionsRepository } from '@app/features/collections/storage/chrome-local-collections.repository'
import {
  BrowserFileContentAdapter,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import { IndexedDbFileContentStore } from '@app/platform/browser/indexeddb-file-content.store'
import { useDocumentTitle } from '@app/shared/hooks/use-document-title'

const collectionsRepository = new ChromeLocalCollectionsRepository()
// Reads the same file store the dashboard writes to, in the same origin.
const fileContentAdapter = new BrowserFileContentAdapter(
  new IndexedDbFileContentStore(),
)

/** Leaves this page for another address without a history entry, so Back skips it. */
function replaceWindowLocation(url: string): void {
  window.location.replace(url)
}

interface AppProps {
  readonly repository?: CollectionsRepository
  readonly fileContent?: FileContentAdapter
  /** How the page leaves for a PDF's document address; defaults to `location.replace`. */
  readonly replaceLocation?: (url: string) => void
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
  readonly replaceLocation: (url: string) => void
  readonly documentUnavailable: boolean
}

/** Connects the viewer to reading the file and naming the tab. */
function FileViewerScreen({
  resource,
  fileContent,
  replaceLocation,
  documentUnavailable,
}: FileViewerScreenProps) {
  const viewer = useFileViewer({
    fileContent,
    resource,
    replaceLocation,
    documentUnavailable,
  })

  useDocumentTitle(resource.name)

  return (
    <FileViewer
      resource={resource}
      state={viewer.state}
      onRetry={viewer.retry}
    />
  )
}

/**
 * The page a file resource is viewed on. The dashboard navigates here for a
 * Markdown file, passing the resource's id in the address; this looks the
 * resource up and shows it. A PDF arrives here only when its document address
 * could not serve it, and leaves again as soon as it can be read. Composition
 * only — reading and rendering live in the feature.
 */
function App({
  repository = collectionsRepository,
  fileContent = fileContentAdapter,
  replaceLocation = replaceWindowLocation,
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
      replaceLocation={replaceLocation}
      documentUnavailable={readFileDocumentUnavailable(search)}
    />
  )
}

export default App
