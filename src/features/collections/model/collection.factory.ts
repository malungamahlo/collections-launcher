import type {
  Collection,
  Timestamp,
  WebsiteResource,
} from './collection.types'

/** User-provided values required to create a new collection. */
export interface CreateCollectionInput {
  readonly name: string
  readonly description?: string
  readonly icon?: string
  readonly color?: string
}

/** User-provided values required to create a website resource. */
export interface CreateWebsiteResourceInput {
  readonly name: string
  readonly url: string
  readonly iconUrl?: string
}

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
 * Trims required text and rejects values that contain only whitespace.
 */
function normalizeRequiredText(value: string, field: string): string {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new TypeError(`${field} cannot be empty`)
  }

  return normalizedValue
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
    name: normalizeRequiredText(input.name, 'Collection name'),
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    ...(color ? { color } : {}),
    resources: [],
    createdAt: timestamp,
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
    name: normalizeRequiredText(input.name, 'Website name'),
    url: normalizeRequiredText(input.url, 'Website URL'),
    ...(iconUrl ? { iconUrl } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}
