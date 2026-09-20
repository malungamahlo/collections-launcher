import { describe, expect, it } from 'vitest'
import {
  getFileSizeValidationError,
  MAX_FILE_RESOURCE_SIZE_BYTES,
} from './file-resource.validation'

describe('getFileSizeValidationError', () => {
  it('accepts an ordinary size, an empty file, and exactly the limit', () => {
    expect(getFileSizeValidationError(2_048)).toBeUndefined()
    expect(getFileSizeValidationError(0)).toBeUndefined()
    expect(getFileSizeValidationError(MAX_FILE_RESOURCE_SIZE_BYTES)).toBeUndefined()
  })

  it('rejects a file one byte over the limit, naming the limit', () => {
    expect(
      getFileSizeValidationError(MAX_FILE_RESOURCE_SIZE_BYTES + 1),
    ).toBe('Files must be 100 MB or smaller.')
  })

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'reports an unreadable size for %s',
    sizeBytes => {
      expect(getFileSizeValidationError(sizeBytes)).toBe(
        'This file’s size could not be determined.',
      )
    },
  )

  it('sets the limit at 100 MB', () => {
    expect(MAX_FILE_RESOURCE_SIZE_BYTES).toBe(104_857_600)
  })
})
