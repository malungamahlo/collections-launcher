import { describe, expect, it } from 'vitest'
import { COLLECTION_NAME_MAX_LENGTH } from '@app/features/collections/model/collection.validation'
import {
  filterValidBundleResources,
  parseImportedBundleText,
} from './bundle.validation'
import { MAX_BUNDLE_RESOURCES } from './bundle.schema'
import { createBundleObject, createBundleText } from '../test/portability.fixtures'

describe('parseImportedBundleText', () => {
  it('returns valid for a well-formed bundle', () => {
    const result = parseImportedBundleText(createBundleText())

    expect(result.status).toBe('valid')
  })

  it('returns malformed for non-JSON text', () => {
    expect(parseImportedBundleText('{ this is not json').status).toBe(
      'malformed',
    )
  })

  it('returns malformed for valid JSON that is not a bundle object', () => {
    expect(parseImportedBundleText('[1,2,3]').status).toBe('malformed')
    expect(parseImportedBundleText('"just a string"').status).toBe(
      'malformed',
    )
    expect(parseImportedBundleText('null').status).toBe('malformed')
    expect(parseImportedBundleText('42').status).toBe('malformed')
  })

  it('returns malformed for empty input', () => {
    expect(parseImportedBundleText('').status).toBe('malformed')
  })

  it('returns unsupported-format for a mismatched format field', () => {
    const result = parseImportedBundleText(
      createBundleText({ format: 'some-other-format' }),
    )

    expect(result.status).toBe('unsupported-format')
  })

  it('returns unsupported-format when format is missing entirely', () => {
    const bundleObject = createBundleObject()
    delete bundleObject.format

    expect(parseImportedBundleText(JSON.stringify(bundleObject)).status).toBe(
      'unsupported-format',
    )
  })

  it('returns unsupported-version for a future schema version', () => {
    const result = parseImportedBundleText(
      createBundleText({ schemaVersion: 999 }),
    )

    expect(result).toEqual({ status: 'unsupported-version', schemaVersion: 999 })
  })

  it('returns malformed when resources is not an array', () => {
    const result = parseImportedBundleText(
      createBundleText({ collection: { resources: 'not-an-array' } }),
    )

    expect(result.status).toBe('malformed')
  })

  it('returns malformed for an oversized collection name', () => {
    const result = parseImportedBundleText(
      createBundleText({
        collection: { name: 'A'.repeat(COLLECTION_NAME_MAX_LENGTH + 1) },
      }),
    )

    expect(result.status).toBe('malformed')
  })

  it('returns malformed for a missing or whitespace-only collection name', () => {
    expect(
      parseImportedBundleText(createBundleText({ collection: { name: '' } }))
        .status,
    ).toBe('malformed')
    expect(
      parseImportedBundleText(
        createBundleText({ collection: { name: '   ' } }),
      ).status,
    ).toBe('malformed')
  })

  it('returns malformed for an oversized resources array', () => {
    const oversizedResources = Array.from(
      { length: MAX_BUNDLE_RESOURCES + 1 },
      (_, index) => ({
        name: `Resource ${index}`,
        url: `https://example.com/${index}`,
      }),
    )

    const result = parseImportedBundleText(
      createBundleText({ collection: { resources: oversizedResources } }),
    )

    expect(result.status).toBe('malformed')
  })

  it('accepts a structurally valid resource with a javascript: URL, deferring rejection to filterValidBundleResources', () => {
    const result = parseImportedBundleText(
      createBundleText({
        collection: {
          resources: [{ name: 'Evil', url: 'javascript:alert(1)' }],
        },
      }),
    )

    expect(result.status).toBe('valid')
  })

  it('never throws for arbitrary hostile input', () => {
    const hostileInputs = [
      '',
      'undefined',
      '{',
      '{"format": null}',
      '{"collection": null}',
      JSON.stringify({
        format: 'collections-launcher',
        schemaVersion: 1,
        collection: 42,
      }),
      JSON.stringify({ format: 'collections-launcher', schemaVersion: '1' }),
    ]

    for (const input of hostileInputs) {
      expect(() => parseImportedBundleText(input)).not.toThrow()
    }
  })
})

describe('filterValidBundleResources', () => {
  it('keeps a valid resource and normalizes its URL and name', () => {
    const result = filterValidBundleResources([
      { name: '  GitHub  ', url: 'github.com' },
    ])

    expect(result).toEqual({
      validResources: [{ name: 'GitHub', url: 'https://github.com/' }],
      skippedInvalidCount: 0,
    })
  })

  it('skips a resource with a javascript: URL', () => {
    const result = filterValidBundleResources([
      { name: 'Evil', url: 'javascript:alert(1)' },
    ])

    expect(result.validResources).toEqual([])
    expect(result.skippedInvalidCount).toBe(1)
  })

  it('skips a resource with an empty or whitespace-only name', () => {
    const result = filterValidBundleResources([
      { name: '   ', url: 'https://example.com' },
    ])

    expect(result.validResources).toEqual([])
    expect(result.skippedInvalidCount).toBe(1)
  })

  it('skips a resource with an oversized name', () => {
    const result = filterValidBundleResources([
      { name: 'A'.repeat(1_000), url: 'https://example.com' },
    ])

    expect(result.validResources).toEqual([])
    expect(result.skippedInvalidCount).toBe(1)
  })

  it('counts invalid entries independently of valid ones, preserving valid order', () => {
    const result = filterValidBundleResources([
      { name: 'GitHub', url: 'https://github.com/' },
      { name: '', url: 'https://example.com' },
      { name: 'Evil', url: 'javascript:alert(1)' },
      { name: 'MDN', url: 'https://developer.mozilla.org/' },
    ])

    expect(result.validResources).toEqual([
      { name: 'GitHub', url: 'https://github.com/' },
      { name: 'MDN', url: 'https://developer.mozilla.org/' },
    ])
    expect(result.skippedInvalidCount).toBe(2)
  })

  it('returns no skips for an empty resource list', () => {
    expect(filterValidBundleResources([])).toEqual({
      validResources: [],
      skippedInvalidCount: 0,
    })
  })
})
