import { describe, expect, it } from 'vitest'
import {
  createTestFileResource,
  createTestWebsiteResource,
} from '@app/features/collections/test/collection.fixtures'
import { collectionPackageManifestSchema } from '../validation/bundle.schema'
import {
  createEmptyTestCollection,
  createManyResourcesTestCollection,
  createSingleResourceTestCollection,
  TEST_SHA256,
} from '../test/portability.fixtures'
import {
  collectionToPackageManifest,
  planPackageAttachments,
  type AttachmentFacts,
} from './bundle.mapper'
import { BUNDLE_FORMAT, PACKAGE_SCHEMA_VERSION } from './bundle.types'

const fixedNow = () => 2_000

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const GITHUB = createTestWebsiteResource({ id: 'site-1', name: 'GitHub', url: 'https://github.com/' })
const HANDBOOK = createTestFileResource({ id: 'file-1', name: 'Handbook', mimeType: 'application/pdf', sizeBytes: 10 })
const MDN = createTestWebsiteResource({ id: 'site-2', name: 'MDN', url: 'https://developer.mozilla.org/' })
const CONTRACT = createTestFileResource({ id: 'file-2', name: 'Contract', mimeType: DOCX, sizeBytes: 20 })

const MIXED = createEmptyTestCollection({
  name: 'Mixed',
  resources: [GITHUB, HANDBOOK, MDN, CONTRACT],
})

function facts(entries: Record<string, AttachmentFacts>): Map<string, AttachmentFacts> {
  return new Map(Object.entries(entries))
}

const MIXED_FACTS = facts({
  'attachments/0001.pdf': { sizeBytes: 4_096, sha256: TEST_SHA256 },
  'attachments/0002.docx': { sizeBytes: 8_192, sha256: 'b'.repeat(64) },
})

describe('planPackageAttachments', () => {
  it('lists the collection’s files in order, each with the path it will have', () => {
    expect(planPackageAttachments(MIXED)).toEqual([
      { resourceId: 'file-1', name: 'Handbook', path: 'attachments/0001.pdf' },
      { resourceId: 'file-2', name: 'Contract', path: 'attachments/0002.docx' },
    ])
  })

  it('numbers files among files, not among all resources', () => {
    const collection = createEmptyTestCollection({ resources: [GITHUB, MDN, HANDBOOK] })

    expect(planPackageAttachments(collection).map(attachment => attachment.path)).toEqual([
      'attachments/0001.pdf',
    ])
  })

  it('has nothing to attach for a collection of websites', () => {
    expect(planPackageAttachments(createManyResourcesTestCollection())).toEqual([])
  })

  it('never uses a resource’s name in a path, however it is spelled', () => {
    const hostile = createTestFileResource({
      id: 'file-x',
      name: '../../evil\\name?.pdf',
      mimeType: 'application/pdf',
    })

    expect(planPackageAttachments(createEmptyTestCollection({ resources: [hostile] }))[0]?.path).toBe(
      'attachments/0001.pdf',
    )
  })
})

describe('collectionToPackageManifest', () => {
  it('produces the envelope at schema version 2', () => {
    const manifest = collectionToPackageManifest(createEmptyTestCollection(), facts({}), fixedNow)

    expect(manifest.format).toBe(BUNDLE_FORMAT)
    expect(manifest.schemaVersion).toBe(PACKAGE_SCHEMA_VERSION)
    expect(manifest.exportedAt).toBe(new Date(2_000).toISOString())
    expect(manifest.collection).toEqual({ name: 'Empty Collection', resources: [] })
  })

  it('keeps every resource, websites and files alike, in the collection’s order', () => {
    const manifest = collectionToPackageManifest(MIXED, MIXED_FACTS, fixedNow)

    expect(manifest.collection.resources).toEqual([
      { type: 'website', name: 'GitHub', url: 'https://github.com/' },
      {
        type: 'file',
        name: 'Handbook',
        mimeType: 'application/pdf',
        sizeBytes: 4_096,
        sha256: TEST_SHA256,
        attachment: 'attachments/0001.pdf',
      },
      { type: 'website', name: 'MDN', url: 'https://developer.mozilla.org/' },
      {
        type: 'file',
        name: 'Contract',
        mimeType: DOCX,
        sizeBytes: 8_192,
        sha256: 'b'.repeat(64),
        attachment: 'attachments/0002.docx',
      },
    ])
  })

  it('records the size of the bytes being packed, not the size noted when the file was added', () => {
    const manifest = collectionToPackageManifest(MIXED, MIXED_FACTS, fixedNow)
    const handbook = manifest.collection.resources[1]

    // HANDBOOK was added at 10 bytes; the file on disk has since grown.
    expect(handbook?.type === 'file' && handbook.sizeBytes).toBe(4_096)
  })

  it('carries the collection’s description, icon and colour, and leaves out what it lacks', () => {
    const styled = collectionToPackageManifest(
      createSingleResourceTestCollection({ icon: 'book', color: '#ff0000' }),
      facts({}),
      fixedNow,
    )
    expect(styled.collection).toMatchObject({
      description: 'Daily development tools',
      icon: 'book',
      color: '#ff0000',
    })

    const plain = collectionToPackageManifest(createEmptyTestCollection(), facts({}), fixedNow)
    expect(plain.collection).not.toHaveProperty('description')
    expect(plain.collection).not.toHaveProperty('icon')
    expect(plain.collection).not.toHaveProperty('color')
  })

  it('writes no local identifier or timestamp anywhere in the manifest', () => {
    const text = JSON.stringify(collectionToPackageManifest(MIXED, MIXED_FACTS, fixedNow))

    for (const secret of ['site-1', 'file-1', 'site-2', 'file-2', MIXED.id, 'createdAt', 'updatedAt', '"id"']) {
      expect(text).not.toContain(secret)
    }
  })

  it('writes a manifest its own schema accepts', () => {
    const manifest = collectionToPackageManifest(MIXED, MIXED_FACTS, fixedNow)

    expect(collectionPackageManifestSchema.safeParse(manifest).success).toBe(true)
  })

  it('refuses to write a manifest for a file whose bytes were never read', () => {
    expect(() =>
      collectionToPackageManifest(
        MIXED,
        facts({ 'attachments/0001.pdf': { sizeBytes: 1, sha256: TEST_SHA256 } }),
        fixedNow,
      ),
    ).toThrow('Contract')
  })
})
