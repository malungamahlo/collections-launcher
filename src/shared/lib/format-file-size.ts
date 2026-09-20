const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/**
 * Formats a byte count for display: `512 B`, `1.5 KB`, `12 MB`. Uses 1024-byte
 * units (as file managers do) and at most one decimal place, dropping a
 * trailing `.0`. An unusable count (negative, NaN, infinite) reads as `0 B`.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)

  return `${text} ${UNITS[unitIndex]}`
}
