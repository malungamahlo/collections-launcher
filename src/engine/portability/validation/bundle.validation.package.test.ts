import { describe, expect, it } from 'vitest'
import { COLLECTION_NAME_MAX_LENGTH } from '@app/features/collections/model/collection.validation'
import { BUNDLE_SCHEMA_VERSION, type PackageResourceEntry } from '../model/bundle.types'
import {
  createBundleText,
  createManifestFileEntry,
  createManifestObject,
  createManifestText,
  TEST_SHA256,
} from '../test/portability.fixtures'
import { MAX_BUNDLE_RESOURCES } from './bundle.schema'
import {
  filterValidPackageEntries,
  parseImportedBundleText,
  parsePackageManifestText,
} from './bundle.validation'

/** A manifest whose one file entry has the given fields changed. */
function manifestWithFile(overrides: Record<string, unknown>): string {
  return createManifestText({
    collection: { resources: [createManifestFileEntry(overrides)] },
  })
}

describe('parsePackageManifestText', () => {
  it('accepts a manifest listing a website and a file', () => {
    const result = parsePackageManifestText(createManifestText())

    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.manifest.collection.resources).toEqual([
        { type: 'website', name: 'GitHub', url: 'https://github.com/' },
        {
          type: 'file',
          name: 'Handbook',
          mimeType: 'application/pdf',
          sizeBytes: 2_048,
          sha256: TEST_SHA256,
          attachment: 'attachments/0001.pdf',
        },
      ])
    }
  })

  it('accepts a manifest with no resources, and one of only websites', () => {
    expect(parsePackageManifestText(createManifestText({ collection: { resources: [] } })).status).toBe('valid')
    expect(
      parsePackageManifestText(
        createManifestText({
          collection: { resources: [{ type: 'website', name: 'A', url: 'https://a.example/' }] },
        }),
      ).status,
    ).toBe('valid')
  })

  it.each([['not json at all'], ['[]'], ['null'], ['"text"'], ['']])(
    'calls %j malformed',
    text => {
      expect(parsePackageManifestText(text)).toEqual({ status: 'malformed' })
    },
  )

  it('reports a document of another format', () => {
    expect(parsePackageManifestText(createManifestText({ format: 'something-else' }))).toEqual({
      status: 'unsupported-format',
    })
  })

  it.each([[BUNDLE_SCHEMA_VERSION], [3], [0]])(
    'reports schema version %i as unsupported: a manifest is version 2',
    schemaVersion => {
      expect(parsePackageManifestText(createManifestText({ schemaVersion }))).toEqual({
        status: 'unsupported-version',
        schemaVersion,
      })
    },
  )

  it('does not accept a version 1 document as a manifest, nor a manifest as a version 1 document', () => {
    expect(parsePackageManifestText(createBundleText()).status).toBe('unsupported-version')
    expect(parseImportedBundleText(createManifestText()).status).toBe('unsupported-version')
  })

  it('rejects a collection name the app would not accept', () => {
    expect(parsePackageManifestText(createManifestText({ collection: { name: '   ' } }))).toEqual({
      status: 'malformed',
    })
    expect(
      parsePackageManifestText(
        createManifestText({ collection: { name: 'x'.repeat(COLLECTION_NAME_MAX_LENGTH + 1) } }),
      ),
    ).toEqual({ status: 'malformed' })
  })

  it('rejects an entry with no type, or a type it does not know', () => {
    for (const entry of [
      { name: 'GitHub', url: 'https://github.com/' },
      { type: 'note', name: 'Idea', text: 'hello' },
    ]) {
      expect(
        parsePackageManifestText(createManifestText({ collection: { resources: [entry] } })),
      ).toEqual({ status: 'malformed' })
    }
  })

  it.each([
    ['climbs out of the package', '../secret.pdf'],
    ['climbs through the folder', 'attachments/../../secret.pdf'],
    ['is absolute', '/attachments/0001.pdf'],
    ['uses a backslash', 'attachments\\0001.pdf'],
    ['is nested', 'attachments/x/0001.pdf'],
    ['is a user’s file name', 'attachments/report.pdf'],
    ['names the manifest', 'manifest.json'],
    ['is empty', ''],
  ])('rejects the whole manifest when an attachment path %s', (_label, attachment) => {
    expect(parsePackageManifestText(manifestWithFile({ attachment }))).toEqual({
      status: 'malformed',
    })
  })

  it.each([
    ['too short', 'abc123'],
    ['upper-case', 'A'.repeat(64)],
    ['not hex', 'g'.repeat(64)],
    ['too long', 'a'.repeat(65)],
    ['a number', 12],
  ])('rejects a SHA-256 that is %s', (_label, sha256) => {
    expect(parsePackageManifestText(manifestWithFile({ sha256 }))).toEqual({ status: 'malformed' })
  })

  it.each([[-1], [1.5], ['2048'], [null], [Number.MAX_SAFE_INTEGER + 2]])(
    'rejects the size %s',
    sizeBytes => {
      expect(parsePackageManifestText(manifestWithFile({ sizeBytes }))).toEqual({
        status: 'malformed',
      })
    },
  )

  it('rejects a file entry missing any of its fields', () => {
    for (const field of ['name', 'mimeType', 'sizeBytes', 'sha256', 'attachment']) {
      const entry = createManifestFileEntry()
      delete entry[field]

      expect(
        parsePackageManifestText(createManifestText({ collection: { resources: [entry] } })),
        field,
      ).toEqual({ status: 'malformed' })
    }
  })

  it('rejects two file entries that name the same attachment', () => {
    expect(
      parsePackageManifestText(
        createManifestText({
          collection: {
            resources: [
              createManifestFileEntry({ name: 'One' }),
              createManifestFileEntry({ name: 'Two' }),
            ],
          },
        }),
      ),
    ).toEqual({ status: 'malformed' })
  })

  it('rejects more resources than a collection may declare', () => {
    const resources = Array.from({ length: MAX_BUNDLE_RESOURCES + 1 }, (_, index) => ({
      type: 'website',
      name: `Site ${index}`,
      url: `https://example.com/${index}`,
    }))

    expect(parsePackageManifestText(createManifestText({ collection: { resources } }))).toEqual({
      status: 'malformed',
    })
  })

  it('ignores fields it does not know, so nothing unexpected is carried along', () => {
    const object = createManifestObject()
    ;(object as Record<string, unknown>).script = '<script>alert(1)</script>'

    const result = parsePackageManifestText(JSON.stringify(object))

    expect(result.status).toBe('valid')
    expect(result.status === 'valid' && 'script' in result.manifest).toBe(false)
  })
})

describe('filterValidPackageEntries', () => {
  const file = (overrides: Partial<PackageResourceEntry> = {}): PackageResourceEntry =>
    ({
      type: 'file',
      name: 'Handbook',
      mimeType: 'application/pdf',
      sizeBytes: 2_048,
      sha256: TEST_SHA256,
      attachment: 'attachments/0001.pdf',
      ...overrides,
    }) as PackageResourceEntry

  it('keeps valid websites and files, in order', () => {
    const entries: PackageResourceEntry[] = [
      { type: 'website', name: 'GitHub', url: 'https://github.com/' },
      file(),
    ]

    expect(filterValidPackageEntries(entries)).toEqual({
      validEntries: entries,
      skippedInvalidCount: 0,
    })
  })

  it('normalizes a website the way adding one by hand does', () => {
    const { validEntries } = filterValidPackageEntries([
      { type: 'website', name: '  GitHub  ', url: 'github.com' },
    ])

    expect(validEntries).toEqual([
      { type: 'website', name: 'GitHub', url: 'https://github.com/' },
    ])
  })

  it('trims a file’s name and normalizes its type', () => {
    const { validEntries } = filterValidPackageEntries([
      file({ name: '  Handbook  ', mimeType: 'Application/PDF; charset=binary' }),
    ])

    expect(validEntries[0]).toMatchObject({ name: 'Handbook', mimeType: 'application/pdf' })
  })

  it('gives a file with no declared type the generic one', () => {
    const { validEntries } = filterValidPackageEntries([file({ mimeType: '' })])

    expect(validEntries[0]).toMatchObject({ mimeType: 'application/octet-stream' })
  })

  it('skips and counts an entry with an invalid name or URL, keeping the rest', () => {
    const result = filterValidPackageEntries([
      { type: 'website', name: '', url: 'https://a.example/' },
      { type: 'website', name: 'Bad link', url: 'javascript:alert(1)' },
      file({ name: '   ' }),
      file({ name: 'Kept', attachment: 'attachments/0002.pdf' }),
    ])

    expect(result.skippedInvalidCount).toBe(3)
    expect(result.validEntries.map(entry => entry.name)).toEqual(['Kept'])
  })
})
