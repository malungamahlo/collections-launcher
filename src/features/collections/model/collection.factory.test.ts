import { describe, expect, it } from 'vitest'
import {
  createCollection,
  createWebsiteResource,
  type FactoryDependencies,
} from './collection.factory'

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
    ).toThrow('Collection name cannot be empty')
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
