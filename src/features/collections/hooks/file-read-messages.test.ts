import { describe, expect, it } from 'vitest'
import {
  describeFileReadFailure,
  describeFileSaveFailure,
} from './file-read-messages'

describe('describeFileReadFailure', () => {
  it('explains a missing file', () => {
    expect(describeFileReadFailure('Handbook', 'NOT_FOUND')).toBe(
      '"Handbook" could not be found. It may have been moved, renamed, or deleted.',
    )
  })

  it('asks the user to allow access after a refusal', () => {
    const message = describeFileReadFailure('Handbook', 'PERMISSION_DENIED')

    expect(message).toContain('"Handbook"')
    expect(message).toContain('Try again')
  })

  it('says an unavailable file could not be opened', () => {
    expect(describeFileReadFailure('Handbook', 'UNAVAILABLE')).toBe(
      '"Handbook" could not be opened. Try again.',
    )
  })
})

describe('describeFileSaveFailure', () => {
  it('explains a missing file', () => {
    expect(describeFileSaveFailure('Handbook', 'NOT_FOUND')).toContain(
      'nothing to save',
    )
  })

  it('points the user back at Save a copy after a refusal', () => {
    expect(describeFileSaveFailure('Handbook', 'PERMISSION_DENIED')).toContain(
      'Save a copy again',
    )
  })

  it('says an unavailable file could not be saved', () => {
    expect(describeFileSaveFailure('Handbook', 'UNAVAILABLE')).toBe(
      '"Handbook" could not be saved. Try again.',
    )
  })
})
