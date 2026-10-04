// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import { isFileResource } from '@app/features/collections/model/resource.guards'
import {
  createTestCollection,
  createTestState,
} from '@app/features/collections/test/collection.fixtures'
import {
  createPackageFile,
  createValidManifest,
  fileEntryFor,
  HANDBOOK_BYTES,
} from '../test/package.fixtures'
import { createManifestObject } from '../test/portability.fixtures'
import { useImportCollection, type StorageEstimateLike } from './use-import-collection'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PLENTY: StorageEstimateLike = { quota: 10_000_000_000, usage: 0 }

/** Renders the hook over an in-memory file store, recording what is written and removed. */
function renderImport(
  options: {
    state?: CollectionsState
    save?: (state: CollectionsState) => Promise<void>
    saveBlob?: (id: string, blob: Blob) => Promise<void>
    estimate?: StorageEstimateLike | undefined | (() => Promise<StorageEstimateLike | undefined>)
  } = {},
) {
  const stored = new Map<string, Blob>()
  const save = vi.fn(options.save ?? (() => Promise.resolve()))
  const fileContent = {
    saveBlob: vi.fn(
      options.saveBlob ??
        ((id: string, blob: Blob) => {
          stored.set(id, blob)

          return Promise.resolve()
        }),
    ),
    remove: vi.fn((id: string) => {
      stored.delete(id)

      return Promise.resolve()
    }),
  }
  const estimate = options.estimate
  const hook = renderHook(() =>
    useImportCollection({
      state: options.state ?? createTestState(),
      save,
      fileContent,
      estimateStorage:
        typeof estimate === 'function'
          ? estimate
          : () => Promise.resolve('estimate' in options ? estimate : PLENTY),
    }),
  )

  return { ...hook, save, fileContent, stored }
}

/** A package holding two files, so a failure can strike between them. */
async function twoFilePackage(): Promise<File> {
  const second = new TextEncoder().encode('%PDF-1.7 the second one')

  return createPackageFile({
    manifest: createManifestObject({
      collection: {
        resources: [
          fileEntryFor(HANDBOOK_BYTES, { name: 'First' }),
          fileEntryFor(second, { name: 'Second', attachment: 'attachments/0002.pdf' }),
        ],
      },
    }),
    attachments: {
      'attachments/0001.pdf': HANDBOOK_BYTES,
      'attachments/0002.pdf': second,
    },
  })
}

describe('useImportCollection with a package', () => {
  it('previews a package’s websites and files', async () => {
    const { result } = renderImport()

    await act(async () => result.current.handleFileSelected(await createPackageFile()))

    const state = result.current.importState
    expect(state.status).toBe('previewing')
    if (state.status === 'previewing') {
      expect(state.chosenName).toBe('Development')
      expect(state.preview.resources.map(resource => resource.name)).toEqual(['GitHub', 'Handbook'])
    }
  })

  it('says it is reading while a package is checked', async () => {
    const { result } = renderImport()
    const file = await createPackageFile()

    let reading!: Promise<void>
    act(() => {
      reading = result.current.handleFileSelected(file)
    })
    expect(result.current.importState.status).toBe('reading')

    await act(() => reading)
    expect(result.current.importState.status).toBe('previewing')
  })

  it('stores each file under its new resource’s id, then saves the collection', async () => {
    const { result, save, stored } = renderImport()
    await act(async () => result.current.handleFileSelected(await createPackageFile()))

    await act(() => result.current.confirmImport())

    expect(result.current.importState).toEqual({
      status: 'done',
      collectionName: 'Development',
      resourceCount: 2,
      addedToExisting: false,
    })
    const [collection] = save.mock.calls[0]?.[0].collections ?? []
    const [file] = collection?.resources.filter(isFileResource) ?? []
    expect(file).toMatchObject({ name: 'Handbook', mimeType: 'application/pdf', sizeBytes: HANDBOOK_BYTES.byteLength })
    expect([...stored.keys()]).toEqual([file?.id])
    expect(new Uint8Array(await (stored.get(file?.id ?? '') as Blob).arrayBuffer())).toEqual(HANDBOOK_BYTES)
  })

  it('stores the files before saving the collection, so a saved file resource always has its content', async () => {
    const order: string[] = []
    const { result } = renderImport({
      saveBlob: () => {
        order.push('file')

        return Promise.resolve()
      },
      save: () => {
        order.push('collections')

        return Promise.resolve()
      },
    })
    await act(async () => result.current.handleFileSelected(await twoFilePackage()))

    await act(() => result.current.confirmImport())

    expect(order).toEqual(['file', 'file', 'collections'])
  })

  describe('is all or nothing', () => {
    it('removes the files already stored when a later one cannot be stored, and saves nothing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      let calls = 0
      const { result, save, fileContent } = renderImport({
        saveBlob: () => {
          calls += 1

          return calls === 2
            ? Promise.reject(new DOMException('full', 'QuotaExceededError'))
            : Promise.resolve()
        },
      })
      await act(async () => result.current.handleFileSelected(await twoFilePackage()))

      await act(() => result.current.confirmImport())

      expect(save).not.toHaveBeenCalled()
      // Both the one that was stored and the one that failed part-way.
      const attempted = fileContent.saveBlob.mock.calls.map(([id]) => id)
      expect(fileContent.remove.mock.calls.map(([id]) => id).sort()).toEqual([...attempted].sort())
      expect(result.current.importState).toEqual({
        status: 'error',
        message: 'The collection could not be imported. Nothing was added. Try again.',
      })
    })

    it('removes every stored file when the collection itself cannot be saved', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { result, stored, fileContent } = renderImport({
        save: () => Promise.reject(new Error('storage down')),
      })
      await act(async () => result.current.handleFileSelected(await twoFilePackage()))

      await act(() => result.current.confirmImport())

      expect(fileContent.saveBlob).toHaveBeenCalledTimes(2)
      expect(stored.size).toBe(0)
      expect(result.current.importState.status).toBe('error')
    })

    it('stores nothing when the name was taken while the preview was open', async () => {
      const state = createTestState()
      const { result, rerender, save, fileContent } = renderImport({ state })
      await act(async () => result.current.handleFileSelected(await createPackageFile()))
      // Another tab creates a collection with this name while the preview is open.
      ;(state as { collections: unknown }).collections = [
        createTestCollection({ name: 'Development' }),
      ]
      rerender()

      await act(() => result.current.confirmImport())

      expect(fileContent.saveBlob).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
    })
  })

  describe('checks there is room first', () => {
    it('stops, storing nothing, when the browser has less room than the files need', async () => {
      const { result, save, fileContent } = renderImport({
        estimate: { quota: 1_000, usage: 995 },
      })
      await act(async () => result.current.handleFileSelected(await createPackageFile()))

      await act(() => result.current.confirmImport())

      expect(fileContent.saveBlob).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
      expect(result.current.importState).toEqual({
        status: 'error',
        message:
          'There isn’t enough room in this browser to store these files: 21 B is needed and 5 B is free. Nothing was added.',
      })
    })

    it.each([
      ['cannot say how much room it has', undefined],
      ['gives no figures', {}],
    ])('goes ahead when the browser %s', async (_label, estimate) => {
      const { result, save } = renderImport({ estimate })
      await act(async () => result.current.handleFileSelected(await createPackageFile()))

      await act(() => result.current.confirmImport())

      expect(save).toHaveBeenCalledOnce()
    })

    it('goes ahead when asking fails', async () => {
      const { result, save } = renderImport({ estimate: () => Promise.reject(new Error('no')) })
      await act(async () => result.current.handleFileSelected(await createPackageFile()))

      await act(() => result.current.confirmImport())

      expect(save).toHaveBeenCalledOnce()
    })

    it('does not ask at all for an import with no files', async () => {
      const estimate = vi.fn(() => Promise.resolve(PLENTY))
      const { result } = renderImport({ estimate })
      const websitesOnly = await createPackageFile({
        manifest: createManifestObject({
          collection: { resources: [{ type: 'website', name: 'A', url: 'https://a.example/' }] },
        }),
        attachments: {},
      })
      await act(async () => result.current.handleFileSelected(websitesOnly))

      await act(() => result.current.confirmImport())

      expect(estimate).not.toHaveBeenCalled()
    })
  })

  describe('a file that cannot be imported', () => {
    it.each([
      [
        'a damaged package',
        async () =>
          createPackageFile({
            manifest: createManifestObject({
              collection: { resources: [fileEntryFor(HANDBOOK_BYTES, { sha256: 'b'.repeat(64) })] },
            }),
          }),
        'This file is damaged, or was changed after it was exported, so it can’t be imported. Nothing was added.',
      ],
      [
        'a zip that is not a package',
        async () => createPackageFile({ manifest: null }),
        "This file isn't a valid Collections Launcher export.",
      ],
      [
        'a package from a newer version',
        async () => createPackageFile({ manifest: { ...createValidManifest(), schemaVersion: 3 } }),
        'This file was exported by a newer version of Collections Launcher and can’t be imported here.',
      ],
    ])('says why for %s, and stores nothing', async (_label, build, message) => {
      const { result, fileContent, save } = renderImport()

      await act(async () => result.current.handleFileSelected(await build()))

      expect(result.current.importState).toEqual({ status: 'error', message })
      expect(fileContent.saveBlob).not.toHaveBeenCalled()
      expect(save).not.toHaveBeenCalled()
    })

    it('says a file is too large without reading it', async () => {
      const { result } = renderImport()
      const giant = { size: 600 * 1024 * 1024, slice: vi.fn(), arrayBuffer: vi.fn(), text: vi.fn() }

      await act(() => result.current.handleFileSelected(giant as unknown as File))

      expect(result.current.importState).toEqual({
        status: 'error',
        message:
          'This file is too large to import. An export can hold up to 500 MB of files, each up to 100 MB.',
      })
      expect(giant.arrayBuffer).not.toHaveBeenCalled()
    })
  })

  it('does not bring a preview back after the dialog was closed while reading', async () => {
    const { result } = renderImport()
    const file = await createPackageFile()

    let reading!: Promise<void>
    act(() => {
      reading = result.current.handleFileSelected(file)
    })
    act(() => result.current.close())
    await act(() => reading)

    expect(result.current.importState).toEqual({ status: 'idle' })
  })
})
