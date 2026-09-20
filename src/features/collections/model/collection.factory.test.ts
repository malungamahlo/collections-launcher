import { describe, expect, it } from 'vitest'
import {
  createCollection,
  createFileResource,
  createWebsiteResource,
  type FactoryDependencies,
  updateCollectionMetadata,
  updateWebsiteResourceMetadata,
} from './collection.factory'
import { MAX_FILE_RESOURCE_SIZE_BYTES } from './file-resource.validation'
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
    ).toThrow('Enter a resource name.')
  })
})

describe('createFileResource', () => {
  it('creates a normalized file resource with no content reference', () => {
    const resource = createFileResource(
      {
        name: '  Employee handbook  ',
        mimeType: ' Application/PDF ',
        sizeBytes: 2_048,
      },
      fixedDependencies,
    )

    expect(resource).toEqual({
      id: 'generated-id',
      type: 'file',
      name: 'Employee handbook',
      mimeType: 'application/pdf',
      sizeBytes: 2_048,
      createdAt: 1_000,
      updatedAt: 1_000,
    })
  })

  it('falls back to application/octet-stream for an empty MIME type', () => {
    const resource = createFileResource(
      { name: 'Mystery', mimeType: '', sizeBytes: 10 },
      fixedDependencies,
    )

    expect(resource.mimeType).toBe('application/octet-stream')
  })

  it('applies the same name rules as any resource', () => {
    expect(() =>
      createFileResource(
        { name: '   ', mimeType: 'application/pdf', sizeBytes: 10 },
        fixedDependencies,
      ),
    ).toThrow('Enter a resource name.')
    expect(() =>
      createFileResource(
        { name: 'N'.repeat(101), mimeType: 'application/pdf', sizeBytes: 10 },
        fixedDependencies,
      ),
    ).toThrow('100 characters or fewer')
  })

  it('accepts an empty file and a file exactly at the size limit', () => {
    expect(() =>
      createFileResource(
        { name: 'Empty', mimeType: 'text/markdown', sizeBytes: 0 },
        fixedDependencies,
      ),
    ).not.toThrow()
    expect(() =>
      createFileResource(
        {
          name: 'At the limit',
          mimeType: 'application/pdf',
          sizeBytes: MAX_FILE_RESOURCE_SIZE_BYTES,
        },
        fixedDependencies,
      ),
    ).not.toThrow()
  })

  it('rejects a file over the size limit', () => {
    expect(() =>
      createFileResource(
        {
          name: 'Too big',
          mimeType: 'application/pdf',
          sizeBytes: MAX_FILE_RESOURCE_SIZE_BYTES + 1,
        },
        fixedDependencies,
      ),
    ).toThrow('100 MB or smaller')
  })

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an unusable size of %s',
    sizeBytes => {
      expect(() =>
        createFileResource(
          { name: 'Odd', mimeType: 'application/pdf', sizeBytes },
          fixedDependencies,
        ),
      ).toThrow('could not be determined')
    },
  )

  it('generates a fresh id and timestamps each time by default', () => {
    const first = createFileResource({
      name: 'One',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    })
    const second = createFileResource({
      name: 'Two',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    })

    expect(first.id).not.toBe(second.id)
    expect(first.createdAt).toBe(first.updatedAt)
  })
})

describe('updateWebsiteResourceMetadata', () => {
  it('normalizes editable values and preserves resource identity', () => {
    const original = {
      id: 'resource-1',
      type: 'website' as const,
      name: 'GitHub',
      url: 'https://github.com/',
      createdAt: 1_000,
      updatedAt: 1_000,
    }

    const updated = updateWebsiteResourceMetadata(
      original,
      {
        name: '  GitHub Projects  ',
        url: ' github.com/features/issues ',
      },
      2_000,
    )

    expect(updated).toEqual({
      ...original,
      name: 'GitHub Projects',
      url: 'https://github.com/features/issues',
      iconUrl: undefined,
      updatedAt: 2_000,
    })
  })
})
