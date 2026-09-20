import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RESOURCE_KIND,
  RESOURCE_KINDS,
} from '../model/resource-kind-registry'
import { RESOURCE_ICONS } from './resource-icons'

describe('RESOURCE_ICONS', () => {
  it('has an icon for every kind in the registry, including the default', () => {
    for (const kind of [...RESOURCE_KINDS, DEFAULT_RESOURCE_KIND]) {
      expect(RESOURCE_ICONS[kind.iconKey]).toBeDefined()
    }
  })

  it('gives different kinds of file different icons where the registry asks for it', () => {
    const pdf = RESOURCE_KINDS.find(kind => kind.id === 'pdf')!
    const excel = RESOURCE_KINDS.find(kind => kind.id === 'excel')!

    expect(RESOURCE_ICONS[pdf.iconKey]).not.toBe(RESOURCE_ICONS[excel.iconKey])
  })
})
