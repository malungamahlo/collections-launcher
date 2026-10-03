import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/**
 * Builds the icon Windows shows on an exported `.collectionLauncher` file:
 * `assets/collection-file.svg` drawn at every size Explorer asks for, packed
 * into one `.ico`. The result is committed, so setting the icon up
 * (`tools/windows-file-icon/install.ps1`) needs no build.
 *
 * Run with `npm run build:file-icon`. Pass `--preview <folder>` to also write
 * each size as a PNG, to look at them.
 */

const source = fileURLToPath(new URL('../assets/collection-file.svg', import.meta.url))
const output = fileURLToPath(
  new URL('../tools/windows-file-icon/collection-file.ico', import.meta.url),
)

/** The sizes Explorer uses, from a details-view row to an extra-large thumbnail. */
const SIZES = [16, 24, 32, 48, 64, 256]

/** At and below this size the mark's three lines are thinner than a pixel and only blur it. */
const SIMPLIFIED_UP_TO = 24

/** The mark's lines: the only elements filled with this colour. */
const LINE = /\s*<rect [^>]*fill="#fff7ed"[^>]*\/>/g

async function render(svg, size) {
  const drawing = size <= SIMPLIFIED_UP_TO ? svg.replace(LINE, '') : svg

  return sharp(Buffer.from(drawing), { density: (72 * size) / 128 * 4 })
    .resize(size, size)
    .png()
    .toBuffer()
}

/**
 * Packs PNG images into an ICO file: a 6-byte header, a 16-byte directory
 * entry per image, then the images themselves. Windows has read PNG-encoded
 * entries since Vista.
 */
function packIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = header.length + directory.length

  images.forEach(({ size, png }, index) => {
    const entry = index * 16
    // A width or height of 0 means 256.
    directory.writeUInt8(size === 256 ? 0 : size, entry)
    directory.writeUInt8(size === 256 ? 0 : size, entry + 1)
    directory.writeUInt8(0, entry + 2) // no palette
    directory.writeUInt8(0, entry + 3) // reserved
    directory.writeUInt16LE(1, entry + 4) // colour planes
    directory.writeUInt16LE(32, entry + 6) // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })

  return Buffer.concat([header, directory, ...images.map(image => image.png)])
}

const svg = await readFile(source, 'utf8')
const images = await Promise.all(
  SIZES.map(async size => ({ size, png: await render(svg, size) })),
)

await mkdir(dirname(output), { recursive: true })
await writeFile(output, packIco(images))
console.log(`Wrote ${output} (${SIZES.join(', ')} px)`)

const previewFlag = process.argv.indexOf('--preview')

if (previewFlag !== -1 && process.argv[previewFlag + 1]) {
  const folder = process.argv[previewFlag + 1]
  await mkdir(folder, { recursive: true })

  for (const { size, png } of images) {
    await writeFile(join(folder, `collection-file-${size}.png`), png)
  }

  console.log(`Wrote previews to ${folder}`)
}
