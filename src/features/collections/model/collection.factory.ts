import type {
  Collection,
  Timestamp,
  WebsiteResource,
} from './collection.types'
import { normalizeCollectionName } from './collection.validation'
import { normalizeWebsiteName } from './website-resource.validation'
import { normalizeWebsiteUrl } from './website-url'

/** User-provided values required to create a new collection. */
export interface CreateCollectionInput {
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
}

/** User-provided values that can change on an existing collection. */
export type UpdateCollectionMetadataInput = CreateCollectionInput

/** User-provided values required to create a website resource. */
export interface CreateWebsiteResourceInput {
  readonly name: string
  readonly url: string
  readonly iconUrl?: string
}

/** User-provided values that can change on an existing website resource. */
export type UpdateWebsiteResourceInput = CreateWebsiteResourceInput

/**
 * Replaceable system functions used by the factories.
 * Supplying fixed implementations makes factory behaviour easy to test.
 */
export interface FactoryDependencies {
  readonly generateId: () => string
  readonly now: () => Timestamp
}

/** Browser implementations used during normal application execution. */
const defaultDependencies: FactoryDependencies = {
  generateId: () => crypto.randomUUID(),
  now: () => Date.now(),
}

/**
 * Trims optional text and converts empty values to undefined.
 */
function normalizeOptionalText(value?: string): string | undefined {
  const normalizedValue = value?.trim()
  return normalizedValue || undefined
}

/**
 * Creates a valid empty collection with a generated ID and timestamps.
 */
export function createCollection(
  input: CreateCollectionInput,
  dependencies: FactoryDependencies = defaultDependencies,
): Collection {
  const timestamp = dependencies.now()
  const description = normalizeOptionalText(input.description)
  const icon = normalizeOptionalText(input.icon)
  const color = normalizeOptionalText(input.color)

  return {
    id: dependencies.generateId(),
    name: normalizeCollectionName(input.name),
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    ...(color ? { color } : {}),
    resources: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/**
 * Applies normalized metadata while preserving identity, resources, and creation time.
 */
export function updateCollectionMetadata(
  collection: Collection,
  input: UpdateCollectionMetadataInput,
  timestamp: Timestamp = Date.now(),
): Collection {
  const description = normalizeOptionalText(input.description)
  const icon = normalizeOptionalText(input.icon)
  const color = normalizeOptionalText(input.color)

  return {
    ...collection,
    name: normalizeCollectionName(input.name),
    ...(description ? { description } : { description: undefined }),
    ...(icon ? { icon } : { icon: undefined }),
    ...(color ? { color } : { color: undefined }),
    updatedAt: timestamp,
  }
}

/**
 * Creates a valid website resource with a generated ID and timestamps.
 */
export function createWebsiteResource(
  input: CreateWebsiteResourceInput,
  dependencies: FactoryDependencies = defaultDependencies,
): WebsiteResource {
  const timestamp = dependencies.now()
  const iconUrl = normalizeOptionalText(input.iconUrl)

  return {
    id: dependencies.generateId(),
    type: 'website',
    name: normalizeWebsiteName(input.name),
    url: normalizeWebsiteUrl(input.url),
    ...(iconUrl ? { iconUrl } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/**
 * Applies normalized website metadata while preserving identity and creation time.
 */
export function updateWebsiteResourceMetadata(
  resource: WebsiteResource,
  input: UpdateWebsiteResourceInput,
  timestamp: Timestamp = Date.now(),
): WebsiteResource {
  const iconUrl = normalizeOptionalText(input.iconUrl)

  return {
    ...resource,
    name: normalizeWebsiteName(input.name),
    url: normalizeWebsiteUrl(input.url),
    ...(iconUrl ? { iconUrl } : { iconUrl: undefined }),
    updatedAt: timestamp,
  }
}
