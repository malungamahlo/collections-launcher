import { BUNDLE_FILE_EXTENSION } from './bundle.types'

const UNSAFE_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g
const RESERVED_WINDOWS_DEVICE_NAMES =
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
const MAX_FILENAME_STEM_LENGTH = 100
const FALLBACK_FILENAME_STEM = 'collection'

/**
 * Removes characters and trailing whitespace/dots disallowed by common
 * filesystems, without discarding readable unicode text.
 */
function sanitizeFilenameStem(value: string): string {
  const withoutUnsafeCharacters = value.replace(UNSAFE_FILENAME_CHARACTERS, ' ')
  const collapsedWhitespace = withoutUnsafeCharacters
    .replace(/\s+/g, ' ')
    .trim()
  const withoutTrailingDots = collapsedWhitespace.replace(/[.\s]+$/, '')

  return withoutTrailingDots
    .slice(0, MAX_FILENAME_STEM_LENGTH)
    .replace(/[.\s]+$/, '')
}

/**
 * Produces a filesystem-safe download filename for an exported collection,
 * falling back to a generic name when the collection name sanitizes to
 * nothing usable.
 */
export function bundleFileName(collectionName: string): string {
  const sanitizedStem = sanitizeFilenameStem(collectionName)
  const stem =
    sanitizedStem && !RESERVED_WINDOWS_DEVICE_NAMES.test(sanitizedStem)
      ? sanitizedStem
      : FALLBACK_FILENAME_STEM

  return `${stem}${BUNDLE_FILE_EXTENSION}`
}
