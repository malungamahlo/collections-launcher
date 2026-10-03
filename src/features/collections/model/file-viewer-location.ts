import type { ResourceId } from './collection.types'

/**
 * Where a file resource is viewed: this extension's own `viewer` page, which
 * takes the resource to show from its query string. The path must match the
 * `entrypoints/viewer` folder that WXT builds to `/viewer.html`.
 *
 * A Markdown file is shown here. A PDF is shown as the browser's own document
 * instead (`file-document-location.ts`), and comes here only when that could
 * not be served — this page then explains why, or offers to try again.
 *
 * It is a path, not a full URL, so it resolves against whatever extension page
 * opens it and the model layer needs no browser API to know it.
 */
export const FILE_VIEWER_PAGE_PATH = '/viewer.html'

const RESOURCE_PARAMETER = 'resource'
const DOCUMENT_FAILED_PARAMETER = 'document'
const DOCUMENT_FAILED_VALUE = 'unavailable'

interface FileViewerUrlOptions {
  /**
   * Set when the file's document address could not serve it, so the page
   * does not send the tab straight back there (which could loop).
   */
  readonly documentUnavailable?: boolean
}

/** The address of the page that shows one file resource. */
export function buildFileViewerUrl(
  resourceId: ResourceId,
  { documentUnavailable = false }: FileViewerUrlOptions = {},
): string {
  const query = new URLSearchParams({ [RESOURCE_PARAMETER]: resourceId })

  if (documentUnavailable) {
    query.set(DOCUMENT_FAILED_PARAMETER, DOCUMENT_FAILED_VALUE)
  }

  return `${FILE_VIEWER_PAGE_PATH}?${query.toString()}`
}

/**
 * Reads which resource a viewer page was opened for from its query string
 * (`location.search`), or `undefined` when there is none.
 */
export function readFileViewerResourceId(
  search: string,
): ResourceId | undefined {
  return new URLSearchParams(search).get(RESOURCE_PARAMETER) || undefined
}

/** Whether the viewer page was reached because the file's document address could not serve it. */
export function readFileDocumentUnavailable(search: string): boolean {
  return (
    new URLSearchParams(search).get(DOCUMENT_FAILED_PARAMETER) ===
    DOCUMENT_FAILED_VALUE
  )
}
