import { describe, expect, it } from 'vitest'
import {
  createCollection,
  createWebsiteResource,
  type FactoryDependencies,
  updateCollectionMetadata,
} from './collection.factory'
import { createTestCollection } from '../test/collection.fixtures'

const fixedDependencies: FactoryDependencies = {
  generateId: () => 'generated-id',
  now: () => 1_000,
}

describe('createCollection', () => {
  it('creates a normalized empty collection', () => {
    const collection = createCollection(
      {
        name: '  Development  ',
        description: '  Development resources  ',
        icon: '  code  ',
        color: '  orange  ',
      },
      fixedDependencies,
    )

    expect(collection).toEqual({
      id: 'generated-id',
      name: 'Development',
      description: 'Development resources',
      icon: 'code',
      color: 'orange',
      resources: [],
      createdAt: 1_000,
      updatedAt: 1_000,
    })
  })

  it('omits optional text that contains only whitespace', () => {
    const collection = createCollection(
      {
        name: 'Development',
        description: '  ',
      },
      fixedDependencies,
    )

    expect(collection).not.toHaveProperty('description')
  })

  it('rejects a whitespace-only collection name', () => {
    expect(() =>
      createCollection({ name: '   ' }, fixedDependencies),
    ).toThrow('Enter a collection name.')
  })

  it('rejects a collection name longer than 80 characters', () => {
    expect(() =>
      createCollection({ name: 'A'.repeat(81) }, fixedDependencies),
    ).toThrow('Collection names must be 80 characters or fewer.')
  })
})

describe('updateCollectionMetadata', () => {
  it('updates normalized metadata and preserves collection contents', () => {
    const original = createTestCollection()

    const updated = updateCollectionMetadata(
      original,
      {
        name: '  Updated collection  ',
        description: '  Updated description  ',
        icon: '  cloud  ',
        color: '  #2563eb  ',
      },
      2_000,
    )

    expect(updated).toEqual({
      ...original,
      name: 'Updated collection',
      description: 'Updated description',
      icon: 'cloud',
      color: '#2563eb',
      updatedAt: 2_000,
    })
    expect(updated.resources).toBe(original.resources)
  })

  it('removes optional metadata when its edited value is empty', () => {
    const original = createTestCollection({
      description: 'Description',
      icon: 'code',
      color: '#f97316',
    })

    const updated = updateCollectionMetadata(
      original,
      {
        name: original.name,
        description: ' ',
        icon: ' ',
        color: ' ',
      },
      2_000,
    )

    expect(updated.description).toBeUndefined()
    expect(updated.icon).toBeUndefined()
    expect(updated.color).toBeUndefined()
  })
})

describe('createWebsiteResource', () => {
  it('creates a normalized website resource', () => {
    const resource = createWebsiteResource(
      {
        name: '  GitHub  ',
        url: ' github.com ',
        iconUrl: '  https://github.com/favicon.ico  ',
      },
      fixedDependencies,
    )

    expect(resource).toEqual({
      id: 'generated-id',
      type: 'website',
      name: 'GitHub',
      url: 'https://github.com/',
      iconUrl: 'https://github.com/favicon.ico',
      createdAt: 1_000,
      updatedAt: 1_000,
    })
  })

  it('rejects a whitespace-only website name', () => {
    expect(() =>
      createWebsiteResource(
        {
          name: '   ',
          url: 'https://example.com',
        },
        fixedDependencies,
      ),
    ).toThrow('Website name cannot be empty')
  })
})
