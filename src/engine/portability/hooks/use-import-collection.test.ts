// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollectionOperationError } from '@app/features/collections/model/collection.operations'
import type { CollectionsState } from '@app/features/collections/model/collection.types'
import {
  createTestCollection,
  createTestState,
} from '@app/features/collections/test/collection.fixtures'
import { useImportCollection } from './use-import-collection'
import { applyImportPreview } from '../services/import-collection-bundle'
import { createBundleText } from '../test/portability.fixtures'

vi.mock('../services/import-collection-bundle', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../services/import-collection-bundle')>()

  return { ...actual, applyImportPreview: vi.fn(actual.applyImportPreview) }
})

afterEach(() => {
  cleanup()
})

function createTestFile(text: string): File {
  return new File([text], 'bundle.collectionLauncher', {
    type: 'application/json',
  })
}

describe('useImportCollection', () => {
  it('moves to previewing for a valid file', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(
          createBundleText({
            collection: { name: 'Reading list', description: 'Articles' },
          }),
        ),
      )
    })

    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      chosenName: 'Reading list',
      hasNameConflict: false,
    })
  })

  it('flags a name conflict when previewing a name that already exists', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const state = createTestState({
      collections: [createTestCollection({ name: 'Development' })],
    })
    const { result } = renderHook(() =>
      useImportCollection({ state, save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(createBundleText({ collection: { name: 'development' } })),
      )
    })

    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      hasNameConflict: true,
    })
  })

  it('moves to error for non-JSON text', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(createTestFile('{ not json'))
    })

    expect(result.current.importState).toEqual({
      status: 'error',
      message: "This file isn't a valid Collections Launcher export.",
    })
  })

  it('moves to error for a mismatched format', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(createBundleText({ format: 'something-else' })),
      )
    })

    expect(result.current.importState).toEqual({
      status: 'error',
      message: "This file isn't a Collections Launcher export.",
    })
  })

  it('moves to error for an unsupported schema version', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(createBundleText({ schemaVersion: 999 })),
      )
    })

    expect(result.current.importState.status).toBe('error')
  })

  it('moves to error when the file cannot be read', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )
    const unreadableFile = {
      text: () => Promise.reject(new Error('read failed')),
    } as unknown as File
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await act(async () => {
      await result.current.handleFileSelected(unreadableFile)
    })

    expect(result.current.importState).toEqual({
      status: 'error',
      message: 'This file could not be read. Try picking it again.',
    })
    expect(consoleError).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('does not show a name error while typing until the first invalid submit attempt', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(createTestFile(createBundleText()))
    })

    act(() => {
      result.current.updateChosenName('   ')
    })

    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      nameError: undefined,
    })

    await act(async () => {
      await result.current.confirmImport()
    })

    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      nameError: 'Enter a collection name.',
    })

    act(() => {
      result.current.updateChosenName('Still blank   ')
    })

    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      chosenName: 'Still blank   ',
      nameError: undefined,
    })
  })

  it('commits the import and reports the resource count on success', async () => {
    const state = createTestState()
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useImportCollection({ state, save }))

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(
          createBundleText({
            collection: {
              name: 'Development',
              resources: [
                { name: 'GitHub', url: 'https://github.com/' },
                { name: 'MDN', url: 'https://developer.mozilla.org/' },
              ],
            },
          }),
        ),
      )
    })

    await act(async () => {
      await result.current.confirmImport()
    })

    expect(save).toHaveBeenCalledOnce()
    const savedState = save.mock.calls[0][0]
    expect(savedState.collections).toHaveLength(1)
    expect(savedState.collections[0].name).toBe('Development')
    expect(savedState.collections[0].resources).toHaveLength(2)
    expect(result.current.importState).toEqual({
      status: 'done',
      collectionName: 'Development',
      resourceCount: 2,
    })
  })

  it('moves to error and does not throw when save fails', async () => {
    const save = vi
      .fn<(state: CollectionsState) => Promise<void>>()
      .mockRejectedValue(new Error('storage failure'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(createTestFile(createBundleText()))
    })
    await act(async () => {
      await result.current.confirmImport()
    })

    expect(result.current.importState).toEqual({
      status: 'error',
      message: 'The collection could not be imported. Try again.',
    })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('blocks confirmImport with a name-conflict error without calling save', async () => {
    const state = createTestState({
      collections: [createTestCollection({ name: 'Development' })],
    })
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() => useImportCollection({ state, save }))

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(createBundleText({ collection: { name: 'development' } })),
      )
    })

    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      hasNameConflict: true,
    })

    await act(async () => {
      await result.current.confirmImport()
    })

    expect(save).not.toHaveBeenCalled()
    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      nameError: 'A collection with this name already exists.',
    })
  })

  it('returns to previewing with a name-conflict error when addCollection rejects a race, instead of a terminal error', async () => {
    const save = vi
      .fn<(state: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(
        createTestFile(createBundleText({ collection: { name: 'Development' } })),
      )
    })

    vi.mocked(applyImportPreview).mockImplementationOnce(() => {
      throw new CollectionOperationError(
        'DUPLICATE_COLLECTION_NAME',
        'A collection with this name already exists.',
      )
    })

    await act(async () => {
      await result.current.confirmImport()
    })

    expect(save).not.toHaveBeenCalled()
    expect(result.current.importState).toMatchObject({
      status: 'previewing',
      chosenName: 'Development',
      hasNameConflict: true,
      nameError: 'A collection with this name already exists.',
    })
  })

  it('returns to idle from close()', async () => {
    const save = vi.fn<(state: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useImportCollection({ state: createTestState(), save }),
    )

    await act(async () => {
      await result.current.handleFileSelected(createTestFile(createBundleText()))
    })

    act(() => {
      result.current.close()
    })

    expect(result.current.importState).toEqual({ status: 'idle' })
  })
})
