import { describe, expect, it } from 'vitest'
import { bundleFileName } from './bundle-file'
import { BUNDLE_FILE_EXTENSION } from './bundle.types'

describe('bundleFileName', () => {
  it('appends the bundle file extension to a simple name', () => {
    expect(bundleFileName('Development')).toBe(
      `Development${BUNDLE_FILE_EXTENSION}`,
    )
  })

  it('replaces characters unsafe for filenames with spaces', () => {
    expect(bundleFileName('Work / Personal: "Notes"')).toBe(
      `Work Personal Notes${BUNDLE_FILE_EXTENSION}`,
    )
  })

  it('replaces every unsafe filename character', () => {
    expect(bundleFileName('a<b>c:d"e/f\\g|h?i*j')).toBe(
      `a b c d e f g h i j${BUNDLE_FILE_EXTENSION}`,
    )
  })

  it('collapses repeated whitespace and trims the result', () => {
    expect(bundleFileName('  Many    Spaces  ')).toBe(
      `Many Spaces${BUNDLE_FILE_EXTENSION}`,
    )
  })

  it('strips trailing dots left over after sanitizing', () => {
    expect(bundleFileName('Trailing dot.')).toBe(
      `Trailing dot${BUNDLE_FILE_EXTENSION}`,
    )
  })

  it('preserves unicode characters', () => {
    expect(bundleFileName('日本語 コレクション 🎌 café')).toBe(
      `日本語 コレクション 🎌 café${BUNDLE_FILE_EXTENSION}`,
    )
  })

  it('falls back to a generic name for an empty name', () => {
    expect(bundleFileName('')).toBe(`collection${BUNDLE_FILE_EXTENSION}`)
  })

  it('falls back to a generic name for a whitespace-only name', () => {
    expect(bundleFileName('   ')).toBe(`collection${BUNDLE_FILE_EXTENSION}`)
  })

  it('falls back to a generic name for a name that sanitizes to nothing', () => {
    expect(bundleFileName('///:::')).toBe(`collection${BUNDLE_FILE_EXTENSION}`)
  })

  it('falls back to a generic name for a reserved Windows device name', () => {
    expect(bundleFileName('CON')).toBe(`collection${BUNDLE_FILE_EXTENSION}`)
    expect(bundleFileName('lpt1')).toBe(`collection${BUNDLE_FILE_EXTENSION}`)
  })

  it('truncates very long names', () => {
    const longName = 'A'.repeat(200)

    const fileName = bundleFileName(longName)

    expect(fileName).toBe(`${'A'.repeat(100)}${BUNDLE_FILE_EXTENSION}`)
  })
})
