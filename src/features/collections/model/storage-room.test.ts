import { describe, expect, it } from 'vitest'
import { getFreeStorageBytes, getStorageShortfall } from './storage-room'

describe('getFreeStorageBytes', () => {
  it('is what is left of the quota', () => {
    expect(getFreeStorageBytes({ quota: 1_000, usage: 250 })).toBe(750)
  })

  it('is never negative, even when usage is reported above the quota', () => {
    expect(getFreeStorageBytes({ quota: 100, usage: 150 })).toBe(0)
  })

  it.each([[undefined], [{}], [{ quota: 1_000 }], [{ usage: 10 }]])(
    'is unknown when the browser gives %j',
    figures => {
      expect(getFreeStorageBytes(figures)).toBeUndefined()
    },
  )
})

describe('getStorageShortfall', () => {
  it('says how much is needed and how much is free when the files do not fit', () => {
    expect(getStorageShortfall(500, { quota: 1_000, usage: 900 })).toEqual({
      neededBytes: 500,
      freeBytes: 100,
    })
  })

  it.each([
    ['they fit with room to spare', 100, { quota: 1_000, usage: 0 }],
    ['they fit exactly', 100, { quota: 1_000, usage: 900 }],
    ['nothing is needed', 0, { quota: 10, usage: 10 }],
  ])('reports no shortfall when %s', (_label, needed, figures) => {
    expect(getStorageShortfall(needed, figures)).toBeUndefined()
  })

  it('does not treat an unknown amount of room as no room', () => {
    expect(getStorageShortfall(1_000_000, undefined)).toBeUndefined()
    expect(getStorageShortfall(1_000_000, {})).toBeUndefined()
  })
})
