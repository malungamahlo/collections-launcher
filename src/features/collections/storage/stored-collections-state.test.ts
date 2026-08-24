import { describe, expect, it } from 'vitest'
import {
  createEmptyCollectionsState,
  resolveStoredCollectionsState,
} from './stored-collections-state'
import {
  createTestCollection,
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
