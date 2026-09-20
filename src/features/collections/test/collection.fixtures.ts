import {
  COLLECTIONS_SCHEMA_VERSION,
  type Collection,
  type CollectionsState,
  type FileResource,
  type WebsiteResource,
} from '../model/collection.types'

export const TEST_TIMESTAMP = 1_000

/**
 * Creates a valid website resource that tests can customize.
 */
export function createTestWebsiteResource(
  overrides: Partial<WebsiteResource> = {},
): WebsiteResource {
  return {
    id: 'resource-1',
    type: 'website',
    name: 'GitHub',
    url: 'https://github.com/',
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

/**
 * Creates a valid file resource that tests can customize.
 */
export function createTestFileResource(
  overrides: Partial<FileResource> = {},
): FileResource {
  return {
    id: 'file-resource-1',
    type: 'file',
    name: 'Handbook',
    mimeType: 'application/pdf',
    sizeBytes: 2_048,
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

/**
 * Creates a valid collection that tests can customize.
 */
export function createTestCollection(
  overrides: Partial<Collection> = {},
): Collection {
  return {
    id: 'collection-1',
    name: 'Development',
    resources: [],
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

/**
 * Creates a valid versioned state that tests can customize.
 */
export function createTestState(
  overrides: Partial<CollectionsState> = {},
): CollectionsState {
  return {
    schemaVersion: COLLECTIONS_SCHEMA_VERSION,
    collections: [],
    ...overrides,
  }
}
