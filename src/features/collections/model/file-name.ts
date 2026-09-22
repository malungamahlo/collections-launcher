import type { FileResource } from './collection.types'
import { getFileExtension } from './resource-kind-registry'

/** Characters no mainstream file system accepts in a file name. */
const ILLEGAL_FILE_NAME_CHARACTERS: ReadonlySet<string> = new Set([
  '\\',
  '/',
  ':',
  '*',
  '?',
  '"',
  '<',
  '>',
  '|',
])

/** Long enough for any resource name (they are capped at 100 characters), short enough for a full path. */
const MAX_FILE_NAME_BASE_LENGTH = 100

function isIllegalFileNameCharacter(character: string): boolean {
  return (
    ILLEGAL_FILE_NAME_CHARACTERS.has(character) ||
    character.charCodeAt(0) < 32
  )
}

/**
 * Turns a resource's display name into something safe to use as a file name:
 * characters no file system accepts (and control characters) become `_`, and
 * trailing dots and spaces — which Windows refuses — are dropped. A name with
 * nothing usable left becomes `file`.
 */
export function toSafeFileName(name: string): string {
  const cleaned = Array.from(name, character =>
    isIllegalFileNameCharacter(character) ? '_' : character,
  )
    .join('')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, MAX_FILE_NAME_BASE_LENGTH)

  return cleaned || 'file'
}

/**
 * The file name to give a copy of a file resource: its display name made
 * safe, plus the extension its MIME type calls for (unless the name already
 * ends with it). Without the extension an operating system could not tell
 * which application should open the file.
 */
export function getFileResourceFileName(resource: FileResource): string {
  const base = toSafeFileName(resource.name)
  const extension = getFileExtension(resource.mimeType)

  return extension && !base.toLowerCase().endsWith(extension)
    ? `${base}${extension}`
    : base
}
