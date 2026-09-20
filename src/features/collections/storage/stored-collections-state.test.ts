import { describe, expect, it } from 'vitest'
import {
  createEmptyCollectionsState,
  resolveStoredCollectionsState,
} from './stored-collections-state'
import type { FileResource } from '../model/collection.types'
import {
  createTestCollection,
  createTestFileResource,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'

describe('resolveStoredCollectionsState', () => {
  it('returns an empty state when storage is missing', () => {
    expect(resolveStoredCollectionsState(undefined)).toEqual({
      status: 'missing',
      state: createEmptyCollectionsState(),
    })
  })

  it('returns a valid current state unchanged', () => {
    const state = createTestState({
      collections: [
        createTestCollection({
          resources: [createTestWebsiteResource()],
        }),
      ],
    })

    expect(resolveStoredCollectionsState(state)).toEqual({
      status: 'valid',
      state,
    })
  })

  it.each([0, 2])(
    'safely handles unsupported schema version %s',
    schemaVersion => {
      expect(
        resolveStoredCollectionsState({
          schemaVersion,
          collections: [],
        }),
      ).toEqual({
        status: 'unsupported-version',
        storedVersion: schemaVersion,
        state: createEmptyCollectionsState(),
      })
    },
  )

  it('rejects malformed collections', () => {
    expect(
      resolveStoredCollectionsState({
        schemaVersion: 1,
        collections: [{ id: 10 }],
      }).status,
    ).toBe('malformed')
  })

  it('rejects a stored collection name beyond the supported length', () => {
    const state = createTestState({
      collections: [createTestCollection({ name: 'A'.repeat(81) })],
    })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })

  it('rejects a malformed resource URL', () => {
    const resource = createTestWebsiteResource({
      url: 'javascript:alert(1)',
    })
    const state = createTestState({
      collections: [createTestCollection({ resources: [resource] })],
    })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })

  it('rejects duplicate collection IDs', () => {
    const collection = createTestCollection()
    const state = createTestState({
      collections: [collection, { ...collection }],
    })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })

  it('rejects duplicate resource IDs across collections', () => {
    const resource = createTestWebsiteResource()
    const state = createTestState({
      collections: [
        createTestCollection({ resources: [resource] }),
        createTestCollection({
          id: 'collection-2',
          resources: [{ ...resource }],
        }),
      ],
    })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })
})

describe('resolveStoredCollectionsState with file resources', () => {
  /** Wraps a hand-built (possibly malformed) resource in an otherwise valid state. */
  function stateWithResource(resource: unknown) {
    return createTestState({
      collections: [
        createTestCollection({ resources: [resource as FileResource] }),
      ],
    })
  }

  it('returns a state containing a file resource unchanged', () => {
    const state = createTestState({
      collections: [
        createTestCollection({ resources: [createTestFileResource()] }),
      ],
    })

    expect(resolveStoredCollectionsState(state)).toEqual({
      status: 'valid',
      state,
    })
  })

  it('accepts website and file resources side by side in one collection', () => {
    const state = createTestState({
      collections: [
        createTestCollection({
          resources: [createTestWebsiteResource(), createTestFileResource()],
        }),
      ],
    })

    expect(resolveStoredCollectionsState(state).status).toBe('valid')
  })

  it('accepts a MIME type the registry does not know', () => {
    const state = stateWithResource(
      createTestFileResource({ mimeType: 'application/x-something-new' }),
    )

    expect(resolveStoredCollectionsState(state).status).toBe('valid')
  })

  it('accepts an empty file', () => {
    const state = stateWithResource(createTestFileResource({ sizeBytes: 0 }))

    expect(resolveStoredCollectionsState(state).status).toBe('valid')
  })

  it.each([
    ['a missing MIME type', { mimeType: undefined }],
    ['a blank MIME type', { mimeType: '   ' }],
    ['a non-string MIME type', { mimeType: 7 }],
    ['an over-long MIME type', { mimeType: `application/${'x'.repeat(250)}` }],
    ['a missing size', { sizeBytes: undefined }],
    ['a negative size', { sizeBytes: -1 }],
    ['a fractional size', { sizeBytes: 1.5 }],
    ['a NaN size', { sizeBytes: Number.NaN }],
    ['an infinite size', { sizeBytes: Number.POSITIVE_INFINITY }],
    ['an unsafe-integer size', { sizeBytes: Number.MAX_SAFE_INTEGER + 1 }],
    ['a string size', { sizeBytes: '2048' }],
    ['an empty name', { name: '' }],
    ['a blank id', { id: '  ' }],
    ['a negative timestamp', { createdAt: -1 }],
    ['a non-numeric timestamp', { updatedAt: 'yesterday' }],
  ])('rejects a file resource with %s', (_description, override) => {
    const state = stateWithResource({ ...createTestFileResource(), ...override })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })

  it('rejects the whole state when one file resource is malformed among valid ones', () => {
    const state = createTestState({
      collections: [
        createTestCollection({
          resources: [
            createTestWebsiteResource(),
            createTestFileResource({ id: 'good-file', name: 'Good' }),
            { ...createTestFileResource({ id: 'bad-file' }), sizeBytes: -5 } as FileResource,
          ],
        }),
      ],
    })

    expect(resolveStoredCollectionsState(state)).toEqual({
      status: 'malformed',
      state: createEmptyCollectionsState(),
    })
  })

  it('rejects a resource type this version does not know', () => {
    const state = stateWithResource({
      ...createTestFileResource(),
      type: 'notebook',
    })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })

  it('rejects a resource with no type at all', () => {
    const untyped: Record<string, unknown> = { ...createTestFileResource() }
    delete untyped.type

    expect(resolveStoredCollectionsState(stateWithResource(untyped)).status).toBe(
      'malformed',
    )
  })

  it('does not let a website-shaped object pass as a file, or the reverse', () => {
    expect(
      resolveStoredCollectionsState(
        stateWithResource({ ...createTestWebsiteResource(), type: 'file' }),
      ).status,
    ).toBe('malformed')
    expect(
      resolveStoredCollectionsState(
        stateWithResource({ ...createTestFileResource(), type: 'website' }),
      ).status,
    ).toBe('malformed')
  })

  it('rejects a file resource sharing an ID with a website in another collection', () => {
    const state = createTestState({
      collections: [
        createTestCollection({
          resources: [createTestWebsiteResource({ id: 'shared' })],
        }),
        createTestCollection({
          id: 'collection-2',
          name: 'Other',
          resources: [createTestFileResource({ id: 'shared' })],
        }),
      ],
    })

    expect(resolveStoredCollectionsState(state).status).toBe('malformed')
  })
})
