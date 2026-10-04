import type {
  Collection,
  ResourceId,
} from '@app/features/collections/model/collection.types'
import {
  isFileResource,
  isWebsiteResource,
} from '@app/features/collections/model/resource.guards'
import {
  BUNDLE_FORMAT,
  PACKAGE_SCHEMA_VERSION,
  type CollectionPackageManifest,
  type PackageResourceEntry,
} from './bundle.types'
import { buildAttachmentPath } from './package-layout'

/**
 * Converts a stored collection into what an export carries: a manifest of
 * every resource, and the list of files whose content goes with it. Only
 * local identifiers and timestamps are stripped before anything leaves the
 * extension; every visual characteristic — name, description, icon, color — is
 * kept, so an imported collection looks exactly like the one exported.
 *
 * (The version 1 bundle, a JSON document of websites only, is no longer
 * written; it is still read on import.)
 */

/** A file resource's place in a package: which resource, and where its bytes go. */
export interface PackageAttachment {
  /** The local resource whose content is to be read. Never written into the package. */
  readonly resourceId: ResourceId
  /** The resource's name, for naming it in a message if it cannot be read. */
  readonly name: string
  /** Its path inside the package, e.g. `attachments/0001.pdf`. */
  readonly path: string
}

/** What is known about an attachment only once its bytes have been read. */
export interface AttachmentFacts {
  readonly sizeBytes: number
  /** SHA-256 of the bytes, as 64 lower-case hex digits. */
  readonly sha256: string
}

/**
 * The files a collection's package will carry, in resource order, each with
 * the path it will have. Worked out before anything is read, so the exporter
 * knows what to load and where each file goes.
 */
export function planPackageAttachments(collection: Collection): PackageAttachment[] {
  return collection.resources.filter(isFileResource).map((resource, index) => ({
    resourceId: resource.id,
    name: resource.name,
    path: buildAttachmentPath(index + 1, resource.mimeType),
  }))
}

/**
 * Builds a package's manifest: **every** resource of the collection, in
 * order — websites and files alike — stripped of local identifiers and
 * timestamps.
 *
 * A file entry's size and hash come from `facts` (keyed by attachment path),
 * measured from the bytes actually being packed rather than from the size
 * recorded when the file was added: a locally added file is a live reference,
 * and it may have changed since.
 *
 * @throws when `facts` has nothing for one of the collection's files.
 */
export function collectionToPackageManifest(
  collection: Collection,
  facts: ReadonlyMap<string, AttachmentFacts>,
  now: () => number = Date.now,
): CollectionPackageManifest {
  const attachmentByResource = new Map(
    planPackageAttachments(collection).map(attachment => [
      attachment.resourceId,
      attachment.path,
    ]),
  )

  const resources = collection.resources.map((resource): PackageResourceEntry => {
    if (isWebsiteResource(resource)) {
      return { type: 'website', name: resource.name, url: resource.url }
    }

    const attachment = attachmentByResource.get(resource.id)
    const attachmentFacts = attachment ? facts.get(attachment) : undefined

    if (!attachment || !attachmentFacts) {
      throw new Error(`No attachment was prepared for file resource "${resource.name}".`)
    }

    return {
      type: 'file',
      name: resource.name,
      mimeType: resource.mimeType,
      sizeBytes: attachmentFacts.sizeBytes,
      sha256: attachmentFacts.sha256,
      attachment,
    }
  })

  return {
    format: BUNDLE_FORMAT,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    exportedAt: new Date(now()).toISOString(),
    collection: {
      name: collection.name,
      ...(collection.description ? { description: collection.description } : {}),
      ...(collection.icon ? { icon: collection.icon } : {}),
      ...(collection.color ? { color: collection.color } : {}),
      resources,
    },
  }
}
