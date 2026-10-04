import { getFileExtension } from '@app/features/collections/model/resource-kind-registry'
import { PACKAGE_ATTACHMENTS_FOLDER } from './bundle.types'

/**
 * Where attachments sit inside a package. Their names are **generated** — a
 * four-digit number and the extension the file's type calls for — and never
 * taken from a resource's name or the user's file name. So a path can never
 * carry `..`, a slash, a drive letter, a character a file system refuses, or
 * clash with another attachment; and a path read from an untrusted manifest
 * has exactly one acceptable shape to be checked against.
 */

/** The extension given to a file whose type the registry does not know. */
const UNKNOWN_TYPE_EXTENSION = '.bin'

/** The highest position a four-digit name can hold. */
const MAX_POSITION = 9_999

/** `attachments/` + four digits + `.` + 1–8 lower-case letters or digits, and nothing else. */
const ATTACHMENT_PATH = /^attachments\/\d{4}\.[a-z0-9]{1,8}$/

/**
 * The path of the attachment at a 1-based position among a package's files,
 * for a file of the given MIME type: `attachments/0001.pdf`.
 */
export function buildAttachmentPath(position: number, mimeType: string): string {
  if (!Number.isInteger(position) || position < 1 || position > MAX_POSITION) {
    throw new RangeError(`An attachment position must be 1–${MAX_POSITION}; got ${position}.`)
  }

  const extension = getFileExtension(mimeType) || UNKNOWN_TYPE_EXTENSION

  return `${PACKAGE_ATTACHMENTS_FOLDER}${String(position).padStart(4, '0')}${extension}`
}

/**
 * Whether a path read from a manifest is one this app could have written.
 * Anything else — a parent folder, an absolute path, a backslash, a nested
 * folder, an odd extension — is refused, so nothing outside `attachments/`
 * is ever looked up in the zip.
 */
export function isValidAttachmentPath(path: string): boolean {
  return ATTACHMENT_PATH.test(path)
}
