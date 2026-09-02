import { describe, expect, it } from 'vitest'
import { serializeCollectionBundle } from './export-collection-bundle'
import {
  createEmptyTestCollection,
  createSingleResourceTestCollection,
} from '../test/portability.fixtures'

const fixedNow = () => 2_000

describe('serializeCollectionBundle', () => {
  it('produces pretty-printed JSON matching the bundle shape', () => {
    const json = serializeCollectionBundle(
      createSingleResourceTestCollection(),
      fixedNow,
    )

    expect(json).toBe(
      JSON.stringify(
        {
          format: 'collections-launcher',
          schemaVersion: 1,
          exportedAt: new Date(2_000).toISOString(),
          collection: {
            name: 'Development',
            description: 'Daily development tools',
            resources: [{ name: 'GitHub', url: 'https://github.com/' }],
          },
        },
        null,
        2,
      ),
    )
  })

  it('parses back into an object with only the documented top-level fields', () => {
    const json = serializeCollectionBundle(
      createEmptyTestCollection(),
      fixedNow,
    )

    const parsed = JSON.parse(json)

    expect(Object.keys(parsed).sort()).toEqual([
      'collection',
      'exportedAt',
      'format',
      'schemaVersion',
    ])
    expect(Object.keys(parsed.collection).sort()).toEqual([
      'name',
      'resources',
    ])
  })

  it('defaults to the current time when no clock is supplied', () => {
    const json = serializeCollectionBundle(createEmptyTestCollection())

    expect(() => new Date(JSON.parse(json).exportedAt).toISOString()).not.toThrow()
  })
})
