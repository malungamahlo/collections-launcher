import type {
  Collection,
  WebsiteResource,
} from '@app/features/collections/model/collection.types'

const TEST_TIMESTAMP = 1_000

function createTestResource(
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

/** A collection with no resources. */
export function createEmptyTestCollection(
  overrides: Partial<Collection> = {},
): Collection {
  return {
    id: 'collection-empty',
    name: 'Empty Collection',
    resources: [],
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

/** A collection with exactly one resource. */
export function createSingleResourceTestCollection(
  overrides: Partial<Collection> = {},
): Collection {
  return {
    id: 'collection-single',
    name: 'Development',
    description: 'Daily development tools',
    resources: [createTestResource()],
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

/** A collection with several resources. */
export function createManyResourcesTestCollection(
  overrides: Partial<Collection> = {},
): Collection {
  return {
    id: 'collection-many',
    name: 'Research',
    resources: [
      createTestResource({
        id: 'resource-1',
        name: 'GitHub',
        url: 'https://github.com/',
      }),
      createTestResource({
        id: 'resource-2',
        name: 'MDN',
        url: 'https://developer.mozilla.org/',
      }),
      createTestResource({
        id: 'resource-3',
        name: 'Stack Overflow',
        url: 'https://stackoverflow.com/',
      }),
      createTestResource({
        id: 'resource-4',
        name: 'Can I use',
        url: 'https://caniuse.com/',
      }),
      createTestResource({
        id: 'resource-5',
        name: 'TypeScript Docs',
        url: 'https://www.typescriptlang.org/docs/',
      }),
    ],
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}

/** A collection whose name contains non-ASCII characters and unsafe filename characters. */
export function createUnicodeNameTestCollection(
  overrides: Partial<Collection> = {},
): Collection {
  return {
    id: 'collection-unicode',
    name: '日本語 コレクション 🎌 / café',
    resources: [createTestResource()],
    createdAt: TEST_TIMESTAMP,
    updatedAt: TEST_TIMESTAMP,
    ...overrides,
  }
}
