import { describe, expect, it } from 'vitest'
import {
  getWebsiteNameValidationError,
  getWebsiteUrlValidationError,
  normalizeWebsiteName,
  WEBSITE_NAME_MAX_LENGTH,
} from './website-resource.validation'

describe('website resource validation', () => {
  it('validates and normalizes a friendly website name', () => {
    expect(getWebsiteNameValidationError('   ')).toBe(
      'Enter a resource name.',
    )
    expect(
      getWebsiteNameValidationError(
        'A'.repeat(WEBSITE_NAME_MAX_LENGTH + 1),
      ),
    ).toBe('Resource names must be 100 characters or fewer.')
    expect(normalizeWebsiteName('  GitHub  ')).toBe('GitHub')
  })

  it.each([
    ['', 'Enter a resource URL.'],
    ['not a valid URL', 'Enter a valid resource URL.'],
    ['ftp://example.com', 'Resource URL must use HTTP or HTTPS.'],
    ['example.com', undefined],
  ])('validates URL %j', (value, expected) => {
    expect(getWebsiteUrlValidationError(value)).toBe(expected)
  })
})
