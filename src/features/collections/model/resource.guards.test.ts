import { describe, expect, it } from 'vitest'
import {
  createTestFileResource,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { isFileResource, isWebsiteResource } from './resource.guards'

describe('resource type guards', () => {
  it('recognizes a website resource, and only that', () => {
    const website = createTestWebsiteResource()
    const file = createTestFileResource()

    expect(isWebsiteResource(website)).toBe(true)
    expect(isWebsiteResource(file)).toBe(false)
  })

  it('recognizes a file resource, and only that', () => {
    const website = createTestWebsiteResource()
    const file = createTestFileResource()

    expect(isFileResource(file)).toBe(true)
    expect(isFileResource(website)).toBe(false)
  })

  it('narrows the type so website-only fields are reachable', () => {
    const resources = [createTestWebsiteResource(), createTestFileResource()]

    const urls = resources.filter(isWebsiteResource).map(resource => resource.url)
    const mimeTypes = resources
      .filter(isFileResource)
      .map(resource => resource.mimeType)

    expect(urls).toEqual(['https://github.com/'])
    expect(mimeTypes).toEqual(['application/pdf'])
  })
})
