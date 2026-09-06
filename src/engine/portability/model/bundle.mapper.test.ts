import { describe, expect, it } from 'vitest'
import { collectionToBundle } from './bundle.mapper'
import { BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION } from './bundle.types'
import {
  createEmptyTestCollection,
  createManyResourcesTestCollection,
  createSingleResourceTestCollection,
  createUnicodeNameTestCollection,
} from '../test/portability.fixtures'

const fixedNow = () => 2_000

describe('collectionToBundle', () => {
  it('produces the envelope fields', () => {
    const bundle = collectionToBundle(createEmptyTestCollection(), fixedNow)

    expect(bundle.format).toBe(BUNDLE_FORMAT)
    expect(bundle.schemaVersion).toBe(BUNDLE_SCHEMA_VERSION)
    expect(bundle.exportedAt).toBe(new Date(2_000).toISOString())
  })

  it('omits description when the collection has none', () => {
    const bundle = collectionToBundle(createEmptyTestCollection(), fixedNow)

    expect(bundle.collection).toEqual({
      name: 'Empty Collection',
      resources: [],
    })
    expect(bundle.collection).not.toHaveProperty('description')
  })

  it('includes description when the collection has one', () => {
    const bundle = collectionToBundle(
      createSingleResourceTestCollection(),
      fixedNow,
    )

    expect(bundle.collection.name).toBe('Development')
    expect(bundle.collection.description).toBe('Daily development tools')
    expect(bundle.collection.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
    ])
  })

  it('maps only resource name and url, excluding id, iconUrl, and timestamps', () => {
    const collection = createSingleResourceTestCollection({
      resources: [
        {
          id: 'resource-1',
          type: 'website',
          name: 'GitHub',
          url: 'https://github.com/',
          iconUrl: 'https://github.com/favicon.ico',
          createdAt: 1_000,
          updatedAt: 1_000,
        },
      ],
    })

    const bundle = collectionToBundle(collection, fixedNow)

    expect(bundle.collection.resources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
    ])
  })

  it('excludes id, timestamps, and color from the bundled collection', () => {
    const collection = createSingleResourceTestCollection({
      icon: 'code',
      color: '#2563eb',
    })

    const bundle = collectionToBundle(collection, fixedNow)

    expect(bundle.collection).not.toHaveProperty('id')
    expect(bundle.collection).not.toHaveProperty('createdAt')
    expect(bundle.collection).not.toHaveProperty('updatedAt')
    expect(bundle.collection).not.toHaveProperty('color')
  })

  it('includes the icon so an imported collection keeps its look', () => {
    const collection = createSingleResourceTestCollection({ icon: 'code' })

    const bundle = collectionToBundle(collection, fixedNow)

    expect(bundle.collection.icon).toBe('code')
  })

  it('omits icon when the collection has none', () => {
    const bundle = collectionToBundle(createEmptyTestCollection(), fixedNow)

    expect(bundle.collection).not.toHaveProperty('icon')
  })

  it('preserves resource order for collections with many resources', () => {
    const collection = createManyResourcesTestCollection()

    const bundle = collectionToBundle(collection, fixedNow)

    expect(bundle.collection.resources.map((resource) => resource.name)).toEqual(
      ['GitHub', 'MDN', 'Stack Overflow', 'Can I use', 'TypeScript Docs'],
    )
  })

  it('preserves unicode collection names', () => {
    const collection = createUnicodeNameTestCollection()

    const bundle = collectionToBundle(collection, fixedNow)

    expect(bundle.collection.name).toBe('日本語 コレクション 🎌 / café')
  })

  it('defaults exportedAt to the current time when no clock is supplied', () => {
    const bundle = collectionToBundle(createEmptyTestCollection())

    expect(() => new Date(bundle.exportedAt).toISOString()).not.toThrow()
  })
})
