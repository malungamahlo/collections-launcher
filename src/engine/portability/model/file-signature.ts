import { getFileExtension } from '@app/features/collections/model/resource-kind-registry'

/**
 * Whether a file's first bytes look like the type an untrusted manifest says
 * it is. An imported file is handed to a viewer chosen by its declared type —
 * a "PDF" goes to the browser's PDF viewer, a "Word document" to the Word
 * reader — so a file that is plainly something else is refused before it is
 * stored, rather than trusted on the manifest's word.
 *
 * This is a sanity check, not proof: it reads only a signature. The viewers
 * still treat every file as untrusted when they open it.
 */

/** How many bytes from the start of a file the check needs at most. */
export const SIGNATURE_SAMPLE_BYTES = 8 * 1024

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const ZIP = [0x50, 0x4b, 0x03, 0x04] // PK\x03\x04 — every OOXML file is a zip
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] // legacy Office compound file

/** What a file with this extension (as the registry names it) must start with. */
const SIGNATURES: Readonly<Record<string, readonly number[]>> = {
  '.pdf': PDF,
  '.docx': ZIP,
  '.xlsx': ZIP,
  '.pptx': ZIP,
  '.doc': OLE,
  '.xls': OLE,
  '.ppt': OLE,
}

/** Extensions whose files are plain text: they have no signature, but no NUL bytes either. */
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['.md'])

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  )
}

/**
 * Checks the start of a file (up to `SIGNATURE_SAMPLE_BYTES`) against its
 * declared MIME type. A type the registry does not know is not checked: such
 * a file is never shown in the browser, only handed to another application.
 */
export function looksLikeDeclaredType(mimeType: string, sample: Uint8Array): boolean {
  const extension = getFileExtension(mimeType)
  const signature = SIGNATURES[extension]

  if (signature) {
    return startsWith(sample, signature)
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return !sample.subarray(0, SIGNATURE_SAMPLE_BYTES).includes(0)
  }

  return true
}
