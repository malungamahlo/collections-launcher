/**
 * Reading entries of an **untrusted** zip without letting it exhaust memory.
 *
 * A zip's directory declares each entry's uncompressed size, but that is only
 * a claim: a few kilobytes of compressed data can declare a small size and
 * still unpack to gigabytes (a "zip bomb"). So an entry is checked twice — its
 * declared size before anything is unpacked, and the bytes actually produced
 * while it is unpacked, stopping the moment they pass the limit.
 *
 * Written against the zip library's (JSZip's) entry objects, typed loosely so
 * this module needs no dependency of its own.
 */

/**
 * The uncompressed size a zip's directory declares for one entry, known
 * before anything is unpacked. It is read from a field JSZip keeps on each
 * entry but does not document, so anything unexpected there is treated as
 * "unknown, assume the worst" (`Infinity`) rather than as zero.
 */
export function getDeclaredZipEntrySize(entry: object): number {
  const data = (entry as { readonly _data?: { readonly uncompressedSize?: unknown } })._data
  const size = data?.uncompressedSize

  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : Infinity
}

/** Thrown when an entry unpacks to more than it was allowed to. */
export class ZipEntryTooLargeError extends Error {
  constructor() {
    super('A zip entry unpacked to more than its limit.')
    this.name = 'ZipEntryTooLargeError'
  }
}

/** The part of JSZip's streaming interface used here. */
interface ZipEntryStream {
  on(event: 'data', listener: (chunk: Uint8Array) => void): ZipEntryStream
  on(event: 'error', listener: (error: Error) => void): ZipEntryStream
  on(event: 'end', listener: () => void): ZipEntryStream
  resume(): ZipEntryStream
  pause(): ZipEntryStream
}

interface StreamableZipEntry {
  internalStream(type: 'uint8array'): ZipEntryStream
}

/**
 * Unpacks one entry, giving up as soon as it has produced more than
 * `maxBytes` — so memory use is bounded by the limit, whatever the zip
 * claims.
 *
 * @throws ZipEntryTooLargeError when the entry is larger than `maxBytes`;
 *   whatever the library throws when the entry is corrupt.
 */
export function readZipEntryBytes(
  entry: object,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let total = 0
    let isSettled = false
    const stream = (entry as StreamableZipEntry).internalStream('uint8array')

    stream
      .on('data', chunk => {
        if (isSettled) {
          return
        }

        total += chunk.byteLength

        if (total > maxBytes) {
          isSettled = true
          stream.pause()
          reject(new ZipEntryTooLargeError())

          return
        }

        chunks.push(chunk)
      })
      .on('error', error => {
        if (!isSettled) {
          isSettled = true
          reject(error)
        }
      })
      .on('end', () => {
        if (isSettled) {
          return
        }

        isSettled = true
        const bytes = new Uint8Array(total)
        let offset = 0

        for (const chunk of chunks) {
          bytes.set(chunk, offset)
          offset += chunk.byteLength
        }

        resolve(bytes)
      })
      .resume()
  })
}
