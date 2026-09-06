import { describe, expect, it } from 'vitest'
import type { FactoryDependencies } from '@app/features/collections/model/collection.factory'
import { CollectionOperationError } from '@app/features/collections/model/collection.operations'
import {
  createTestCollection,
  createTestState,
} from '@app/features/collections/test/collection.fixtures'
import {
  applyImportPreview,
  buildImportPreview,
  hasCollectionNameConflict,
  type ImportPreview,
} from './import-collection-bundle'
import { createBundleObject } from '../test/portability.fixtures'
import type { CollectionBundle } from '../model/bundle.types'

const fixedDependencies: FactoryDependencies = {
  generateId: () => 'generated-id',
  now: () => 2_000,
}

function createTestBundle(
  overrides: Parameters<typeof createBundleObject>[0] = {},
): CollectionBundle {
  return createBundleObject(overrides) as unknown as CollectionBundle
}

describe('hasCollectionNameConflict', () => {
  it('matches case-insensitively and ignores surrounding whitespace', () => {
    const collections = [createTestCollection({ name: 'Development' })]

    expect(hasCollectionNameConflict('development', collections)).toBe(true)
    expect(hasCollectionNameConflict('  DEVELOPMENT  ', collections)).toBe(
      true,
    )
    expect(hasCollectionNameConflict('Research', collections)).toBe(false)
  })
})

describe('buildImportPreview', () => {
  it('carries over the suggested name and description', () => {
    const bundle = createTestBundle({
      collection: { name: 'Reading list', description: 'Articles' },
    })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.suggestedName).toBe('Reading list')
    expect(preview.description).toBe('Articles')
  })

  it('omits description when the bundle has none', () => {
    const preview = buildImportPreview(createTestBundle(), createTestState())

    expect(preview).not.toHaveProperty('description')
  })

  it('carries over the icon so the imported collection does not default to folder', () => {
    const bundle = createTestBundle({ collection: { icon: 'cloud' } })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.icon).toBe('cloud')
  })

  it('omits icon when the bundle has none', () => {
    const preview = buildImportPreview(createTestBundle(), createTestState())

    expect(preview).not.toHaveProperty('icon')
  })

  it('carries over the color so the imported collection looks identical', () => {
    const bundle = createTestBundle({ collection: { color: '#2563eb' } })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.color).toBe('#2563eb')
  })

  it('omits color when the bundle has none', () => {
    const preview = buildImportPreview(createTestBundle(), createTestState())

    expect(preview).not.toHaveProperty('color')
  })

  it('flags a name conflict against an existing collection, case-insensitively', () => {
    const bundle = createTestBundle({ collection: { name: 'development' } })
    const state = createTestState({
      collections: [createTestCollection({ name: 'Development' })],
    })

    expect(buildImportPreview(bundle, state).hasNameConflict).toBe(true)
  })

  it('does not flag a conflict when no existing collection matches', () => {
    const bundle = createTestBundle({ collection: { name: 'Research' } })
    const state = createTestState({
      collections: [createTestCollection({ name: 'Development' })],
    })

    expect(buildImportPreview(bundle, state).hasNameConflict).toBe(false)
  })

  it('deduplicates resources with the same normalized URL, keeping the first', () => {
    const bundle = createTestBundle({
      collection: {
        resources: [
          { name: 'GitHub', url: 'https://github.com/' },
          { name: 'GitHub (dup)', url: 'github.com' },
          { name: 'MDN', url: 'https://developer.mozilla.org/' },
        ],
      },
    })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
      { name: 'MDN', url: 'https://developer.mozilla.org/' },
    ])
    expect(preview.skippedDuplicateCount).toBe(1)
  })

  it('deduplicates resources with the same name (ignoring case) but different URLs, keeping the first', () => {
    const bundle = createTestBundle({
      collection: {
        resources: [
          { name: 'GitHub', url: 'https://github.com/' },
          { name: 'github', url: 'https://github.com/features' },
          { name: 'MDN', url: 'https://developer.mozilla.org/' },
        ],
      },
    })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
      { name: 'MDN', url: 'https://developer.mozilla.org/' },
    ])
    expect(preview.skippedDuplicateCount).toBe(1)
  })

  it('counts skipped-invalid resources separately from skipped-duplicate ones', () => {
    const bundle = createTestBundle({
      collection: {
        resources: [
          { name: 'GitHub', url: 'https://github.com/' },
          { name: 'GitHub (dup)', url: 'https://github.com/' },
          { name: 'Evil', url: 'javascript:alert(1)' },
          { name: '   ', url: 'https://example.com' },
        ],
      },
    })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
    ])
    expect(preview.skippedDuplicateCount).toBe(1)
    expect(preview.skippedInvalidCount).toBe(2)
  })

  it('returns no resources or skips for an empty resource list', () => {
    const bundle = createTestBundle({ collection: { resources: [] } })

    const preview = buildImportPreview(bundle, createTestState())

    expect(preview.resources).toEqual([])
    expect(preview.skippedDuplicateCount).toBe(0)
    expect(preview.skippedInvalidCount).toBe(0)
  })
})

describe('applyImportPreview', () => {
  const preview: ImportPreview = {
    suggestedName: 'Development',
    description: 'Daily tools',
    hasNameConflict: false,
    resources: [{ name: 'GitHub', url: 'https://github.com/' }],
    skippedDuplicateCount: 0,
    skippedInvalidCount: 0,
  }

  it('builds one new collection with the chosen name and the preview resources', () => {
    const state = createTestState()

    const nextState = applyImportPreview(
      state,
      preview,
      'My Development',
      fixedDependencies,
    )

    expect(nextState.collections).toHaveLength(1)
    expect(nextState.collections[0]).toEqual({
      id: 'generated-id',
      name: 'My Development',
      description: 'Daily tools',
      resources: [
        {
          id: 'generated-id',
          type: 'website',
          name: 'GitHub',
          url: 'https://github.com/',
          createdAt: 2_000,
          updatedAt: 2_000,
        },
      ],
      createdAt: 2_000,
      updatedAt: 2_000,
    })
  })

  it('carries the icon through to the created collection', () => {
    const nextState = applyImportPreview(
      createTestState(),
      { ...preview, icon: 'cloud' },
      'Development',
      fixedDependencies,
    )

    expect(nextState.collections[0]?.icon).toBe('cloud')
  })

  it('leaves the collection iconless when the preview has none', () => {
    const nextState = applyImportPreview(
      createTestState(),
      preview,
      'Development',
      fixedDependencies,
    )

    expect(nextState.collections[0]).not.toHaveProperty('icon')
  })

  it('carries the color through to the created collection', () => {
    const nextState = applyImportPreview(
      createTestState(),
      { ...preview, color: '#2563eb' },
      'Development',
      fixedDependencies,
    )

    expect(nextState.collections[0]?.color).toBe('#2563eb')
  })

  it('leaves the collection colorless when the preview has none', () => {
    const nextState = applyImportPreview(
      createTestState(),
      preview,
      'Development',
      fixedDependencies,
    )

    expect(nextState.collections[0]).not.toHaveProperty('color')
  })

  it('does not mutate the original state', () => {
    const original = createTestState({
      collections: [createTestCollection({ id: 'existing' })],
    })

    const nextState = applyImportPreview(
      original,
      preview,
      'New collection',
      fixedDependencies,
    )

    expect(original.collections).toHaveLength(1)
    expect(nextState.collections).toHaveLength(2)
    expect(nextState).not.toBe(original)
  })

  it('creates two distinct collections when the same bundle is imported twice with different names', () => {
    let idCounter = 0
    const uniqueIdDependencies: FactoryDependencies = {
      generateId: () => `id-${idCounter++}`,
      now: () => 2_000,
    }

    const afterFirstImport = applyImportPreview(
      createTestState(),
      preview,
      preview.suggestedName,
      uniqueIdDependencies,
    )
    const afterSecondImport = applyImportPreview(
      afterFirstImport,
      preview,
      `${preview.suggestedName} 2`,
      uniqueIdDependencies,
    )

    expect(afterSecondImport.collections).toHaveLength(2)
    expect(afterSecondImport.collections[0].id).not.toBe(
      afterSecondImport.collections[1].id,
    )
  })

  it('rejects importing the same bundle twice with the same name, leaving state unchanged', () => {
    let idCounter = 0
    const uniqueIdDependencies: FactoryDependencies = {
      generateId: () => `id-${idCounter++}`,
      now: () => 2_000,
    }

    const afterFirstImport = applyImportPreview(
      createTestState(),
      preview,
      preview.suggestedName,
      uniqueIdDependencies,
    )

    expect(() =>
      applyImportPreview(
        afterFirstImport,
        preview,
        preview.suggestedName,
        uniqueIdDependencies,
      ),
    ).toThrow(CollectionOperationError)
    expect(afterFirstImport.collections).toHaveLength(1)
  })

  it('propagates CollectionOperationError without changing state when the generated id collides', () => {
    const state = createTestState({
      collections: [
        createTestCollection({ id: 'generated-id', name: 'Existing' }),
      ],
    })

    expect(() =>
      applyImportPreview(state, preview, 'New collection', fixedDependencies),
    ).toThrow(CollectionOperationError)
    expect(state.collections).toHaveLength(1)
    expect(state.collections[0].id).toBe('generated-id')
  })
})
