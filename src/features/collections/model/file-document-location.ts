import type { ResourceId } from './collection.types'

/**
 * Where a file resource is shown as the browser's own document — a PDF in
 * Chrome's PDF viewer, filling the tab the way a PDF opened from disk does.
 * No page exists at this path: the extension's service worker answers it
 * with the file itself (`serveFileDocument`).
 *
 * The address ends in the file's name, so the browser's PDF toolbar and its
 * download button both show and use the real name. Only the id is read back;
 * the name is there for the browser and the person, not for the lookup.
 *
 * It is a path, not a full URL, so it resolves against whatever extension page
 * opens it and the model layer needs no browser API to know it.
 */
export const FILE_DOCUMENT_PATH_PREFIX = '/file/'

/** The address that serves one file resource as a document of its own. */
export function buildFileDocumentUrl(
  resourceId: ResourceId,
  fileName: string,
): string {
  return `${FILE_DOCUMENT_PATH_PREFIX}${encodeURIComponent(resourceId)}/${encodeURIComponent(fileName)}`
}

/**
 * Reads which resource a document address is for from its path
 * (`location.pathname`), or `undefined` when the path is not one.
 */
export function readFileDocumentResourceId(
  pathname: string,
): ResourceId | undefined {
  if (!pathname.startsWith(FILE_DOCUMENT_PATH_PREFIX)) {
    return undefined
  }

  const [encodedId, encodedName, ...rest] = pathname
    .slice(FILE_DOCUMENT_PATH_PREFIX.length)
    .split('/')

  if (!encodedId || !encodedName || rest.length > 0) {
    return undefined
  }

  try {
    return decodeURIComponent(encodedId)
  } catch {
    // A malformed escape (`%E0%A4%A`) is not an address this app built.
    return undefined
  }
}
