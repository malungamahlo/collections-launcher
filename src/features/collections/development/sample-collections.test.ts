import { describe, expect, it } from 'vitest'
import { resolveStoredCollectionsState } from '../storage/stored-collections-state'
import { DEVELOPMENT_SAMPLE_STATE } from './sample-collections'

describe('DEVELOPMENT_SAMPLE_STATE', () => {
  it('matches the current persisted-state schema', () => {
    expect(
      resolveStoredCollectionsState(DEVELOPMENT_SAMPLE_STATE).status,
    ).toBe('valid')
  })
})
