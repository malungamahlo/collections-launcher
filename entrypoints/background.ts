import { readFileDocumentResourceId } from '@app/features/collections/model/file-document-location'
import { serveFileDocument } from '@app/features/collections/services/serve-file-document'
import { ChromeLocalCollectionsRepository } from '@app/features/collections/storage/chrome-local-collections.repository'
import { BrowserFileContentAdapter } from '@app/platform/browser/file-content.adapter'
import { IndexedDbFileContentStore } from '@app/platform/browser/indexeddb-file-content.store'

/** The part of a service worker's `FetchEvent` used here (the DOM lib has no worker types). */
interface DocumentFetchEvent extends Event {
  readonly request: Request
  respondWith(response: Promise<Response>): void
}

/**
 * The extension's service worker. Its one job is to answer a file resource's
 * document address (`/file/<id>/<name>`) with the file itself, so a PDF opens
 * as the browser's own document, filling the tab. Composition only — what is
 * served, and when, lives in `serveFileDocument`.
 *
 * It reads the same collections and file store as the pages, in the same
 * origin. Every other request — the pages, their scripts and styles — is left
 * alone and never passes through here.
 */
export default defineBackground(() => {
  const dependencies = {
    repository: new ChromeLocalCollectionsRepository(),
    fileContent: new BrowserFileContentAdapter(new IndexedDbFileContentStore()),
  }

  // Registered while the worker first runs, as a `fetch` listener must be.
  self.addEventListener('fetch', event => {
    const { request } = event as DocumentFetchEvent
    const url = new URL(request.url)

    if (
      request.method !== 'GET' ||
      url.origin !== self.location.origin ||
      !readFileDocumentResourceId(url.pathname)
    ) {
      return
    }

    ;(event as DocumentFetchEvent).respondWith(
      serveFileDocument(url, dependencies).then(
        served => served ?? new Response(null, { status: 404 }),
      ),
    )
  })
})
