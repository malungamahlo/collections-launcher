import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser, type Browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BrowserBookmarksAdapter } from './bookmarks.adapter'

/** Creates a bookmark tree node fixture, folder by default (no `url`). */
function createBookmarkNode(
  overrides: Partial<Browser.bookmarks.BookmarkTreeNode> = {},
): Browser.bookmarks.BookmarkTreeNode {
  return {
    id: 'node',
    title: 'Node',
    ...overrides,
  } as Browser.bookmarks.BookmarkTreeNode
}

/** Replaces the overloaded bookmarks tree API with a promise-based test result. */
function mockGetTree(roots: Browser.bookmarks.BookmarkTreeNode[]) {
  return vi.spyOn(browser.bookmarks, 'getTree').mockImplementation(
    (() => Promise.resolve(roots)) as typeof browser.bookmarks.getTree,
  )
}

describe('BrowserBookmarksAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fakeBrowser.reset()
  })

  it('unwraps the synthetic root and maps folders and bookmarks', async () => {
    mockGetTree([
      createBookmarkNode({
        id: '0',
        title: '',
        children: [
          createBookmarkNode({
            id: '1',
            title: 'Bookmarks bar',
            children: [
              createBookmarkNode({
                id: '2',
                title: 'GitHub',
                url: 'https://github.com/',
              }),
              createBookmarkNode({
                id: '3',
                title: 'Work',
                children: [
                  createBookmarkNode({
                    id: '4',
                    title: 'Docs',
                    url: 'https://docs.example.com/',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ])

    const result = await new BrowserBookmarksAdapter().getTree()

    expect(result).toEqual([
      {
        id: '1',
        title: 'Bookmarks bar',
        children: [
          { id: '2', title: 'GitHub', url: 'https://github.com/' },
          {
            id: '3',
            title: 'Work',
            children: [
              { id: '4', title: 'Docs', url: 'https://docs.example.com/' },
            ],
          },
        ],
      },
    ])
  })

  it('returns an empty array when there is no synthetic root', async () => {
    mockGetTree([])

    await expect(new BrowserBookmarksAdapter().getTree()).resolves.toEqual(
      [],
    )
  })

  it('returns an empty array when the root has no children', async () => {
    mockGetTree([createBookmarkNode({ id: '0', title: '' })])

    await expect(new BrowserBookmarksAdapter().getTree()).resolves.toEqual(
      [],
    )
  })
})
