import { describe, expect, it } from 'vitest'
import {
  COLLECTION_NAME_MAX_LENGTH,
  getCollectionNameValidationError,
  normalizeCollectionName,
} from './collection.validation'

describe('collection name validation', () => {
  it.each(['', '   ', '\t\n'])('rejects an empty name: %j', value => {
    expect(getCollectionNameValidationError(value)).toBe(
      'Enter a collection name.',
    )
  })

  it('accepts and trims a name at the maximum length', () => {
    const name = 'A'.repeat(COLLECTION_NAME_MAX_LENGTH)

    expect(getCollectionNameValidationError(name)).toBeUndefined()
    expect(normalizeCollectionName(`  ${name}  `)).toBe(name)
  })

  it('rejects a name beyond the maximum length', () => {
    const name = 'A'.repeat(COLLECTION_NAME_MAX_LENGTH + 1)

    expect(getCollectionNameValidationError(name)).toBe(
      'Collection names must be 80 characters or fewer.',
    )
    expect(() => normalizeCollectionName(name)).toThrow(
      'Collection names must be 80 characters or fewer.',
    )
  })
})
