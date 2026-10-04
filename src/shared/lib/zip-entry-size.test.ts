import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  getDeclaredZipEntrySize,
  readZipEntryBytes,
  ZipEntryTooLargeError,
} from './zip-entry-size'

async function zipWith(path: string, bytes: Uint8Array, compression: 'STORE' | 'DEFLATE') {
  const zip = new JSZip()
  zip.file(path, bytes, { compression })

  return JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }))
}

const BYTES = Uint8Array.from({ length: 5_000 }, (_, index) => index % 251)

describe('getDeclaredZipEntrySize', () => {
  it.each([['STORE' as const], ['DEFLATE' as const]])(
    'reads what the zip declares for a %s entry',
    async compression => {
      const zip = await zipWith('a.bin', BYTES, compression)

      expect(getDeclaredZipEntrySize(zip.file('a.bin') as object)).toBe(BYTES.byteLength)
    },
  )

  it.each([
    ['nothing there', {}],
    ['not a number', { _data: { uncompressedSize: '12' } }],
    ['negative', { _data: { uncompressedSize: -1 } }],
    ['not finite', { _data: { uncompressedSize: Number.NaN } }],
  ])('assumes the worst when the size is %s', (_label, entry) => {
    expect(getDeclaredZipEntrySize(entry)).toBe(Infinity)
  })
})

describe('readZipEntryBytes', () => {
  it.each([['STORE' as const], ['DEFLATE' as const]])(
    'unpacks a %s entry byte for byte when it is within the limit',
    async compression => {
      const zip = await zipWith('a.bin', BYTES, compression)

      expect(await readZipEntryBytes(zip.file('a.bin') as object, BYTES.byteLength)).toEqual(BYTES)
    },
  )

  it('unpacks an empty entry', async () => {
    const zip = await zipWith('empty.bin', new Uint8Array(), 'STORE')

    expect(await readZipEntryBytes(zip.file('empty.bin') as object, 0)).toEqual(new Uint8Array())
  })

  it('gives up on an entry that unpacks to more than its limit', async () => {
    // 2 MB of zeros deflates to a couple of kilobytes: the shape of a zip bomb.
    const zip = await zipWith('bomb.bin', new Uint8Array(2 * 1024 * 1024), 'DEFLATE')

    await expect(readZipEntryBytes(zip.file('bomb.bin') as object, 1_000)).rejects.toBeInstanceOf(
      ZipEntryTooLargeError,
    )
  })

  it('rejects an entry whose compressed data is corrupt', async () => {
    const zip = new JSZip()
    zip.file('a.bin', BYTES, { compression: 'DEFLATE' })
    const archive = await zip.generateAsync({ type: 'uint8array' })
    // Scribble over the middle of the compressed data.
    archive.fill(0xff, 60, 120)
    const damaged = await JSZip.loadAsync(archive)

    await expect(readZipEntryBytes(damaged.file('a.bin') as object, BYTES.byteLength)).rejects.toThrow()
  })
})
