import { browser, type Browser } from 'wxt/browser'

/** A bookmark or bookmark folder, stripped to what the picker needs. */
export interface BookmarkTreeNode {
  readonly id: string
  readonly title: string
  readonly url?: string
  readonly children?: readonly BookmarkTreeNode[]
}

/** Defines read-only bookmark access needed by application code. */
export interface BookmarksAdapter {
  /** Returns the user's real top-level bookmark folders (e.g. "Bookmarks bar", "Other bookmarks"). */
  getTree(): Promise<readonly BookmarkTreeNode[]>
}

/** Converts a browser bookmark node into the app's own minimal shape. */
function mapBookmarkTreeNode(
  node: Browser.bookmarks.BookmarkTreeNode,
): BookmarkTreeNode {
  return {
    id: node.id,
    title: node.title,
    ...(node.url ? { url: node.url } : {}),
    ...(node.children
      ? { children: node.children.map(mapBookmarkTreeNode) }
      : {}),
  }
}

/**
 * Reads the user's bookmarks through the `bookmarks` permission. Nothing in
 * this adapter (or anything built on it) writes back to the browser's
 * actual bookmarks.
 */
export class BrowserBookmarksAdapter implements BookmarksAdapter {
  async getTree(): Promise<readonly BookmarkTreeNode[]> {
    const roots = await browser.bookmarks.getTree()

    // Chrome wraps the real top-level folders in a single synthetic root
    // node (id "0", no meaningful title) — callers only ever want its
    // children, so that quirk is resolved here rather than everywhere else.
    return (roots[0]?.children ?? []).map(mapBookmarkTreeNode)
  }
}
