import { describe, expect, it } from 'vitest'
import type { BookmarkTreeNode } from '@app/platform/browser/bookmarks.adapter'
import {
  createTestCollection,
  createTestState,
} from '@app/features/collections/test/collection.fixtures'
import { buildBookmarkImportPreview } from './import-bookmark-folder'

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
