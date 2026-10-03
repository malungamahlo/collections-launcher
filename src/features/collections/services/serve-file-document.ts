import {
  FileContentError,
  type FileContentAdapter,
} from '@app/platform/browser/file-content.adapter'
import { findFileResourceById } from '../model/collection.queries'
import { readFileDocumentResourceId } from '../model/file-document-location'
import { getFileResourceFileName } from '../model/file-name'
import { buildFileViewerUrl } from '../model/file-viewer-location'
import { getViewerStrategy } from '../model/resource-kind-registry'
import type { CollectionsRepository } from '../storage/collections.repository'

interface ServeFileDocumentDependencies {
  readonly repository: Pick<CollectionsRepository, 'load'>
  readonly fileContent: Pick<FileContentAdapter, 'load'>
}

const PDF_MIME_TYPE = 'application/pdf'

/**
 * A `Content-Disposition` file name in the RFC 5987 form, which carries any
 * Unicode name. `encodeURIComponent` leaves `'()*` alone, but the header's
 * grammar does not allow them unescaped.
 */
function encodeDispositionFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(
    /['()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/** Sends the tab to the file's viewer page, which explains what went wrong. */
function redirectToViewer(requestUrl: URL, resourceId: string): Response {
  return Response.redirect(
    new URL(
      buildFileViewerUrl(resourceId, { documentUnavailable: true }),
      requestUrl,
    ).href,
    302,
  )
}

/**
 * Answers a request for a file resource's document address
 * (`/file/<id>/<name>`) with the file itself, so the browser opens it as a
 * document of its own — a PDF in Chrome's PDF viewer, filling the tab, with
 * the file's name in the viewer's toolbar, exactly as a PDF opened from disk.
 * The extension's service worker calls this; it needs no window.
 *
 * Only a resource the registry shows with the browser's own PDF viewer is
 * served, and always as a PDF, whatever type the bytes claim, with
 * `nosniff`, so this can never hand the browser an HTML document to run in
 * the extension's origin. Nothing is cached (`no-store`): the file is read
 * where it lives on every load, so a reload shows its current content and no
 * copy is kept anywhere.
 *
 * Anything else — an unknown address, a resource that is gone or is not a
 * PDF, a file that cannot be read — redirects to the viewer page, which
 * shows the right message (and, for a lapsed permission, a button to grant it
 * again, which this context cannot ask for).
 *
 * @returns `undefined` when the address is not a document address at all, so
 *   the request is left to the browser.
 */
export async function serveFileDocument(
  requestUrl: URL,
  { repository, fileContent }: ServeFileDocumentDependencies,
): Promise<Response | undefined> {
  const resourceId = readFileDocumentResourceId(requestUrl.pathname)

  if (!resourceId) {
    return undefined
  }

  try {
    const resource = findFileResourceById(await repository.load(), resourceId)

    if (!resource || getViewerStrategy(resource.mimeType) !== 'native-pdf') {
      return redirectToViewer(requestUrl, resourceId)
    }

    const content = await fileContent.load(resource.id)
    const fileName = getFileResourceFileName(resource)

    return new Response(new Blob([content], { type: PDF_MIME_TYPE }), {
      headers: {
        'Content-Type': PDF_MIME_TYPE,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeDispositionFileName(fileName)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (!(error instanceof FileContentError)) {
      console.error(`Could not serve file resource ${resourceId}`, error)
    }

    return redirectToViewer(requestUrl, resourceId)
  }
}
