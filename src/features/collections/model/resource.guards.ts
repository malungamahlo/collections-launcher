import type {
  CollectionResource,
  FileResource,
  WebsiteResource,
} from './collection.types'

/**
 * Narrows a resource to a website. Anything that needs a website-only field
 * (`url`, `iconUrl`) goes through this rather than assuming every resource
 * has one.
 */
export function isWebsiteResource(
  resource: CollectionResource,
): resource is WebsiteResource {
  return resource.type === 'website'
}

/** Narrows a resource to a file. */
export function isFileResource(
  resource: CollectionResource,
): resource is FileResource {
  return resource.type === 'file'
}
