/** Excel's name for a column: A … Z, AA, AB, … */
export function columnName(index: number): string {
  let value = index + 1
  let name = ''

  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }

  return name
}
