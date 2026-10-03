import { children, child, intAttribute, NS } from './office-package'

/**
 * Colours in DrawingML. A colour is written either directly (`srgbClr`) or as
 * a name in the theme's colour scheme (`schemeClr val="tx1"`), possibly with
 * adjustments (`lumMod`, `lumOff`, `shade`, `tint`). Everything comes out as
 * `#rrggbb` — nothing from the file is passed on as raw CSS.
 */
export interface ColorContext {
  /** The theme's colours by slot (`dk1`, `lt1`, `accent1`, …), as `#rrggbb`. */
  readonly scheme: ReadonlyMap<string, string>
  /** The master's mapping from roles to slots (`bg1` → `lt1`, `tx1` → `dk1`, …). */
  readonly map: ReadonlyMap<string, string>
}

const HEX = /^[0-9a-f]{6}$/i

/** The few preset colour names worth knowing; anything else is ignored. */
const PRESET_COLORS: Readonly<Record<string, string>> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  darkGray: '#a9a9a9',
  lightGray: '#d3d3d3',
  orange: '#ffa500',
}

/** The colour map PowerPoint assumes when a master does not give one. */
const DEFAULT_COLOR_MAP: ReadonlyMap<string, string> = new Map([
  ['bg1', 'lt1'],
  ['tx1', 'dk1'],
  ['bg2', 'lt2'],
  ['tx2', 'dk2'],
])

function toHex(value: string | null | undefined): string | undefined {
  return value && HEX.test(value) ? `#${value.toLowerCase()}` : undefined
}

/** The base colour of one colour element (`srgbClr`, `schemeClr`, …), before adjustments. */
function baseColor(element: Element, context: ColorContext): string | undefined {
  switch (element.localName) {
    case 'srgbClr':
      return toHex(element.getAttribute('val'))
    case 'sysClr':
      return toHex(element.getAttribute('lastClr'))
    case 'prstClr':
      return PRESET_COLORS[element.getAttribute('val') ?? '']
    case 'schemeClr': {
      const name = element.getAttribute('val') ?? ''
      // `phClr` means "the placeholder's colour" — only meaningful inside a theme's style matrix.
      const slot = context.map.get(name) ?? DEFAULT_COLOR_MAP.get(name) ?? name

      return context.scheme.get(slot)
    }
    default:
      return undefined
  }
}

function toRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function toHexString([red, green, blue]: readonly number[]): string {
  return `#${[red, green, blue]
    .map(channel => Math.round(Math.min(255, Math.max(0, channel ?? 0))).toString(16).padStart(2, '0'))
    .join('')}`
}

function rgbToHsl([red, green, blue]: readonly number[]): [number, number, number] {
  const r = (red ?? 0) / 255
  const g = (green ?? 0) / 255
  const b = (blue ?? 0) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (max === min) {
    return [0, 0, lightness]
  }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue: number

  if (max === r) {
    hue = (g - b) / delta + (g < b ? 6 : 0)
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  return [hue / 6, saturation, lightness]
}

function hslToRgb([hue, saturation, lightness]: readonly number[]): number[] {
  const h = hue ?? 0
  const s = saturation ?? 0
  const l = lightness ?? 0

  if (s === 0) {
    return [l * 255, l * 255, l * 255]
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const wrapped = t < 0 ? t + 1 : t > 1 ? t - 1 : t

    if (wrapped < 1 / 6) return p + (q - p) * 6 * wrapped
    if (wrapped < 1 / 2) return q
    if (wrapped < 2 / 3) return p + (q - p) * (2 / 3 - wrapped) * 6

    return p
  }

  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255]
}

/** Applies a colour element's adjustment children (in thousandths of a percent). */
function adjust(hex: string, element: Element): string {
  let rgb: number[] = toRgb(hex)

  for (const modifier of children(element, NS.a)) {
    const value = intAttribute(modifier, 'val')

    if (value === undefined) {
      continue
    }

    const fraction = value / 100_000

    switch (modifier.localName) {
      case 'lumMod': {
        const [h, s, l] = rgbToHsl(rgb)
        rgb = hslToRgb([h, s, l * fraction])
        break
      }
      case 'lumOff': {
        const [h, s, l] = rgbToHsl(rgb)
        rgb = hslToRgb([h, s, Math.min(1, l + fraction)])
        break
      }
      case 'shade':
        rgb = rgb.map(channel => channel * fraction)
        break
      case 'tint':
        rgb = rgb.map(channel => channel + (255 - channel) * (1 - fraction))
        break
      default:
        break
    }
  }

  return toHexString(rgb)
}

/** Reads the one colour element inside a container (a `solidFill`, a `defRPr`'s fill, …). */
export function readColor(container: Element | undefined, context: ColorContext): string | undefined {
  for (const element of children(container, NS.a)) {
    const base = baseColor(element, context)

    if (base) {
      return adjust(base, element)
    }
  }

  return undefined
}

/**
 * The colour a fill-bearing element sets, if it sets a plain one: a solid
 * fill's colour, or a gradient's first stop. `null` for an explicit `noFill`,
 * `undefined` when it says nothing (so an inherited fill applies).
 */
export function readFill(properties: Element | undefined, context: ColorContext): string | null | undefined {
  if (!properties) {
    return undefined
  }

  if (child(properties, NS.a, 'noFill')) {
    return null
  }

  const solid = child(properties, NS.a, 'solidFill')

  if (solid) {
    return readColor(solid, context) ?? undefined
  }

  const gradient = child(properties, NS.a, 'gradFill')
  const firstStop = child(child(gradient, NS.a, 'gsLst'), NS.a, 'gs')

  return firstStop ? readColor(firstStop, context) : undefined
}

/** A theme's colour scheme, by slot name. */
export function readThemeColors(theme: Document | undefined): Map<string, string> {
  const scheme = new Map<string, string>()
  const colorScheme = theme?.getElementsByTagNameNS(NS.a, 'clrScheme')[0]

  for (const slot of children(colorScheme, NS.a)) {
    const color = readColor(slot, { scheme: new Map(), map: new Map() })

    if (color) {
      scheme.set(slot.localName, color)
    }
  }

  return scheme
}

/** A master's (or layout's override) colour map, from its `clrMap` element's attributes. */
export function readColorMap(element: Element | undefined): Map<string, string> {
  const map = new Map<string, string>()

  if (!element) {
    return map
  }

  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes[index]

    if (attribute) {
      map.set(attribute.localName ?? attribute.name, attribute.value)
    }
  }

  return map
}
