import { describe, expect, it } from 'vitest'
import { findFileResourceById } from './collection.queries'
import {
  createTestCollection,
  createTestFileResource,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'

describe('findFileResourceById', () => {
  const file = createTestFileResource({ id: 'file-1', name: 'Handbook' })
  const website = createTestWebsiteResource({ id: 'site-1' })
  const state = createTestState({
    collections: [
      createTestCollection({ id: 'c1', resources: [website] }),
      createTestCollection({ id: 'c2', name: 'Docs', resources: [file] }),
    ],
  })

  it('finds a file in whichever collection holds it', () => {
    expect(findFileResourceById(state, 'file-1')).toBe(file)
  })

  it('does not return a website, even when the id matches', () => {
    expect(findFileResourceById(state, 'site-1')).toBeUndefined()
  })

  it('returns nothing for an id no collection has', () => {
    expect(findFileResourceById(state, 'nope')).toBeUndefined()
  })

  it('returns nothing when there are no collections', () => {
    expect(
      findFileResourceById(createTestState({ collections: [] }), 'file-1'),
    ).toBeUndefined()
  })
})
