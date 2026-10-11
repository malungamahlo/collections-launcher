/**
 * Whether the browser has room for files a collection is about to own. A
 * collection keeps its own copy of every file, so adding or importing one
 * stores its bytes; checking first means the user is told plainly instead of
 * a write failing half-way.
 */

/** The browser's storage figures, as far as it gives them. */
export interface StorageFigures {
  readonly quota?: number
  readonly usage?: number
}

/**
 * How many bytes are free for storing files, or `undefined` when the browser
 * does not say. Not knowing is never treated as "no room".
 */
export function getFreeStorageBytes(figures: StorageFigures | undefined): number | undefined {
  if (figures?.quota === undefined || figures.usage === undefined) {
    return undefined
  }

  return Math.max(0, figures.quota - figures.usage)
}

/**
 * How many bytes short the browser is of storing `neededBytes`, or `undefined`
 * when they fit (or the browser does not say how much room it has).
 */
export function getStorageShortfall(
  neededBytes: number,
  figures: StorageFigures | undefined,
): { readonly neededBytes: number; readonly freeBytes: number } | undefined {
  const freeBytes = getFreeStorageBytes(figures)

  return freeBytes !== undefined && neededBytes > freeBytes
    ? { neededBytes, freeBytes }
    : undefined
}
