import type { ResourceId } from './collection.types'

/**
 * Where a file resource is viewed: this extension's own `viewer` page, which
 * takes the resource to show from its query string. The path must match the
 * `entrypoints/viewer` folder that WXT builds to `/viewer.html`.
 *
 * It is a path, not a full URL, so it resolves against whatever extension page
 * opens it and the model layer needs no browser API to know it.
 */
export const FILE_VIEWER_PAGE_PATH = '/viewer.html'

const RESOURCE_PARAMETER = 'resource'

/** The address of the page that shows one file resource. */
export function buildFileViewerUrl(resourceId: ResourceId): string {
  const query = new URLSearchParams({ [RESOURCE_PARAMETER]: resourceId })

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
