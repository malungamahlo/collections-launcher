import { describe, expect, it } from 'vitest'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import {
  buildBookmarkImportPreview,
  getFolderBookmarks,
  isImportableBookmark,
} from './import-bookmark-folder'

function createFolder(
  overrides: Partial<BookmarkTreeNode> = {},
): BookmarkTreeNode {
  return {
    id: 'folder',
    title: 'Work',
    children: [],
    ...overrides,
  }
}

describe('getFolderBookmarks', () => {
  it('returns only the direct bookmarks, in order, excluding subfolders', () => {
    const folder = createFolder({
      children: [
        { id: '1', title: 'GitHub', url: 'https://github.com/' },
        {
          id: '2',
          title: 'Nested folder',
          children: [
            { id: '3', title: 'Nested bookmark', url: 'https://example.com/' },
          ],
        },
        { id: '4', title: 'MDN', url: 'https://developer.mozilla.org/' },
      ],
    })

    expect(getFolderBookmarks(folder).map(bookmark => bookmark.id)).toEqual([
      '1',
      '4',
    ])
  })

  it('returns nothing for an empty folder or one with no children key', () => {
    expect(getFolderBookmarks(createFolder({ children: [] }))).toEqual([])
    expect(getFolderBookmarks({ id: 'folder', title: 'Work' })).toEqual([])
  })
})

describe('isImportableBookmark', () => {
  it('accepts a normal titled web bookmark', () => {
    expect(
      isImportableBookmark({
        id: '1',
        title: 'GitHub',
        url: 'https://github.com/',
      }),
    ).toBe(true)
  })

  it('rejects an internal browser page', () => {
    expect(
      isImportableBookmark({
        id: '1',
        title: 'Extensions',
        url: 'chrome://extensions/',
      }),
    ).toBe(false)
  })

  it('rejects a javascript: bookmarklet', () => {
    expect(
      isImportableBookmark({
        id: '1',
        title: 'Bookmarklet',
        url: 'javascript:alert(1)',
      }),
    ).toBe(false)
  })

  it('rejects an untitled bookmark', () => {
    expect(
      isImportableBookmark({ id: '1', title: '   ', url: 'https://github.com/' }),
    ).toBe(false)
  })
})

describe('buildBookmarkImportPreview', () => {
  it('maps direct bookmark children into the resource list', () => {
    const folder = createFolder({
      children: [
        { id: '1', title: 'GitHub', url: 'https://github.com/' },
        { id: '2', title: 'MDN', url: 'https://developer.mozilla.org/' },
      ],
    })

    const preview = buildBookmarkImportPreview(folder, createTestState())

    expect(preview.suggestedName).toBe('Work')
    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
      { name: 'MDN', url: 'https://developer.mozilla.org/' },
    ])
    expect(preview.skippedDuplicateCount).toBe(0)
    expect(preview.skippedInvalidCount).toBe(0)
  })

  it('excludes subfolders, only mapping the folder\'s direct bookmarks', () => {
    const folder = createFolder({
      children: [
        { id: '1', title: 'GitHub', url: 'https://github.com/' },
        {
          id: '2',
          title: 'Nested folder',
          children: [
            { id: '3', title: 'Nested bookmark', url: 'https://example.com/' },
          ],
        },
      ],
    })

    const preview = buildBookmarkImportPreview(folder, createTestState())

    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
    ])
  })

  it('skips a bookmark with an internal/invalid URL and counts it', () => {
    const folder = createFolder({
      children: [
        { id: '1', title: 'GitHub', url: 'https://github.com/' },
        { id: '2', title: 'Extensions', url: 'chrome://extensions/' },
      ],
    })

    const preview = buildBookmarkImportPreview(folder, createTestState())

    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
    ])
    expect(preview.skippedInvalidCount).toBe(1)
  })

  it('deduplicates bookmarks that repeat a URL, keeping the first', () => {
    const folder = createFolder({
      children: [
        { id: '1', title: 'GitHub', url: 'https://github.com/' },
        { id: '2', title: 'GitHub (dup)', url: 'github.com' },
      ],
    })

    const preview = buildBookmarkImportPreview(folder, createTestState())

    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
    ])
    expect(preview.skippedDuplicateCount).toBe(1)
  })

  it('returns no resources or skips for an empty folder', () => {
    const preview = buildBookmarkImportPreview(
      createFolder({ children: [] }),
      createTestState(),
    )

    expect(preview.resources).toEqual([])
    expect(preview.skippedDuplicateCount).toBe(0)
    expect(preview.skippedInvalidCount).toBe(0)
  })

  it('returns no resources when the folder has no children at all', () => {
    const folderWithoutChildren: BookmarkTreeNode = {
      id: 'folder',
      title: 'Work',
    }

    const preview = buildBookmarkImportPreview(
      folderWithoutChildren,
      createTestState(),
    )

    expect(preview.resources).toEqual([])
  })

  it('flags a name conflict against an existing collection, case-insensitively', () => {
    const folder = createFolder({ title: 'development' })
    const state = createTestState({
      collections: [createTestCollection({ name: 'Development' })],
    })

    expect(buildBookmarkImportPreview(folder, state).hasNameConflict).toBe(
      true,
    )
  })

  it('does not flag a conflict when no existing collection matches', () => {
    const folder = createFolder({ title: 'Research' })
    const state = createTestState({
      collections: [createTestCollection({ name: 'Development' })],
    })

    expect(buildBookmarkImportPreview(folder, state).hasNameConflict).toBe(
      false,
    )
  })

  describe('with a target collection', () => {
    const target = createTestCollection({
      id: 'target',
      name: 'Reference',
      resources: [
        createTestWebsiteResource({
          name: 'GitHub',
          url: 'https://github.com/',
        }),
      ],
    })

    it('carries the target and uses its name instead of the folder name', () => {
      const preview = buildBookmarkImportPreview(
        createFolder({ title: 'Work' }),
        createTestState({ collections: [target] }),
        target,
      )

      expect(preview.target).toEqual({ id: 'target', name: 'Reference' })
      expect(preview.suggestedName).toBe('Reference')
    })

    it('never flags a name conflict, even when the folder name matches another collection', () => {
      const other = createTestCollection({ id: 'other', name: 'Work' })

      const preview = buildBookmarkImportPreview(
        createFolder({ title: 'Work' }),
        createTestState({ collections: [target, other] }),
        target,
      )

      expect(preview.hasNameConflict).toBe(false)
    })

    it('skips bookmarks the target already has by URL or name, counting them as duplicates', () => {
      const folder = createFolder({
        children: [
          { id: '1', title: 'Code hosting', url: 'https://github.com/' },
          { id: '2', title: 'github', url: 'https://example.com/' },
          { id: '3', title: 'MDN', url: 'https://developer.mozilla.org/' },
        ],
      })

      const preview = buildBookmarkImportPreview(
        folder,
        createTestState({ collections: [target] }),
        target,
      )

      expect(preview.resources).toEqual([
        { name: 'MDN', url: 'https://developer.mozilla.org/' },
      ])
      expect(preview.skippedDuplicateCount).toBe(2)
    })

    it('does not skip those same bookmarks when importing as a new collection', () => {
      const folder = createFolder({
        children: [{ id: '1', title: 'GitHub', url: 'https://github.com/' }],
      })

      const preview = buildBookmarkImportPreview(
        folder,
        createTestState({ collections: [target] }),
      )

      expect(preview).not.toHaveProperty('target')
      expect(preview.resources).toHaveLength(1)
      expect(preview.skippedDuplicateCount).toBe(0)
    })
  })

  describe('with selected bookmarks', () => {
    const folder = createFolder({
      children: [
        { id: '1', title: 'GitHub', url: 'https://github.com/' },
        { id: '2', title: 'MDN', url: 'https://developer.mozilla.org/' },
        { id: '3', title: 'Vitest', url: 'https://vitest.dev/' },
      ],
    })

    it('includes only the selected bookmarks, in folder order', () => {
      const preview = buildBookmarkImportPreview(
        folder,
        createTestState(),
        undefined,
        ['3', '1'],
      )

      expect(preview.resources).toEqual([
        { name: 'GitHub', url: 'https://github.com/' },
        { name: 'Vitest', url: 'https://vitest.dev/' },
      ])
    })

    it('includes nothing when the selection is empty', () => {
      const preview = buildBookmarkImportPreview(
        folder,
        createTestState(),
        undefined,
        [],
      )

      expect(preview.resources).toEqual([])
    })

    it('ignores selected ids that are not in the folder', () => {
      const preview = buildBookmarkImportPreview(
        folder,
        createTestState(),
        undefined,
        ['2', 'not-in-this-folder'],
      )

      expect(preview.resources).toEqual([
        { name: 'MDN', url: 'https://developer.mozilla.org/' },
      ])
    })

    it('still names the new collection after the folder, not after the selection', () => {
      const preview = buildBookmarkImportPreview(
        folder,
        createTestState(),
        undefined,
        ['1'],
      )

      expect(preview.suggestedName).toBe('Work')
    })

    it('combines with a target, deduplicating only the selected bookmarks against it', () => {
      const target = createTestCollection({
        id: 'target',
        name: 'Reference',
        resources: [
          createTestWebsiteResource({
            name: 'GitHub',
            url: 'https://github.com/',
          }),
        ],
      })

      const preview = buildBookmarkImportPreview(
        folder,
        createTestState({ collections: [target] }),
        target,
        ['1', '2'],
      )

      expect(preview.resources).toEqual([
        { name: 'MDN', url: 'https://developer.mozilla.org/' },
      ])
      expect(preview.skippedDuplicateCount).toBe(1)
    })
  })

  it('never includes description, icon, or color', () => {
    const preview = buildBookmarkImportPreview(
      createFolder(),
      createTestState(),
    )

    expect(preview).not.toHaveProperty('description')
    expect(preview).not.toHaveProperty('icon')
    expect(preview).not.toHaveProperty('color')
  })
})
