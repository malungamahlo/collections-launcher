import type {
  Collection,
  FileResource,
  Timestamp,
  WebsiteResource,
} from './collection.types'
import { normalizeCollectionName } from './collection.validation'
import { getFileSizeValidationError } from './file-resource.validation'
import {
  normalizeMimeType,
  UNKNOWN_MIME_TYPE,
} from './resource-kind-registry'
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

/** Values required to create a file resource. */
export interface CreateFileResourceInput {
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
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
 * Creates a valid file resource with a generated ID and timestamps. Only
 * metadata is created here; the file's bytes are stored separately, under the
 * returned resource's `id`, by the file-content adapter. The name follows the
 * same rules as any resource name; the MIME type is normalized (an empty one
 * becomes `application/octet-stream`); the size must be within the supported
 * range.
 */
export function createFileResource(
  input: CreateFileResourceInput,
  dependencies: FactoryDependencies = defaultDependencies,
): FileResource {
  const sizeError = getFileSizeValidationError(input.sizeBytes)

  if (sizeError) {
    throw new TypeError(sizeError)
  }

  const timestamp = dependencies.now()

  return {
    id: dependencies.generateId(),
    type: 'file',
    name: normalizeWebsiteName(input.name),
    mimeType: normalizeMimeType(input.mimeType) || UNKNOWN_MIME_TYPE,
    sizeBytes: input.sizeBytes,
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
