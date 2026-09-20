import { describe, expect, it } from 'vitest'
import { formatFileSize } from './format-file-size'

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [2_048, '2 KB'],
    [1024 * 1024, '1 MB'],
    [12 * 1024 * 1024, '12 MB'],
    [100 * 1024 * 1024, '100 MB'],
    [1024 * 1024 * 1024, '1 GB'],
    [5.25 * 1024 * 1024 * 1024, '5.3 GB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })

  it('never shows a trailing .0', () => {
    expect(formatFileSize(1024 * 1.04)).toBe('1 KB')
  })

  it('stays in GB for very large sizes rather than inventing a bigger unit', () => {
    expect(formatFileSize(5 * 1024 ** 4)).toBe('5120 GB')
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'reads an unusable count of %s as 0 B',
    bytes => {
      expect(formatFileSize(bytes)).toBe('0 B')
    },
  )
})
