import { describe, expect, it } from 'vitest'
import {
  normalizeWebsiteUrl,
  WebsiteUrlError,
  type WebsiteUrlErrorCode,
} from './website-url'

describe('normalizeWebsiteUrl', () => {
  it.each([
    [' example.com ', 'https://example.com/'],
    ['HTTP://Example.com:80/docs', 'http://example.com/docs'],
    ['https://example.com/page?q=1', 'https://example.com/page?q=1'],
  ])('normalizes "%s"', (input, expected) => {
    expect(normalizeWebsiteUrl(input)).toBe(expected)
  })

  it.each<[string, WebsiteUrlErrorCode]>([
    ['', 'EMPTY_URL'],
    ['not a valid URL', 'INVALID_URL'],
    ['ftp://example.com', 'UNSUPPORTED_PROTOCOL'],
    ['javascript:alert(1)', 'UNSUPPORTED_PROTOCOL'],
  ])('rejects "%s" with %s', (input, expectedCode) => {
    try {
      normalizeWebsiteUrl(input)
      throw new Error('Expected URL normalization to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(WebsiteUrlError)
      expect((error as WebsiteUrlError).code).toBe(expectedCode)
    }
  })
})
