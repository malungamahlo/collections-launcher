// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import {
  createTestCollection,
  createTestFileResource,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import type { CollectionsState } from '../model/collection.types'
import { useCollectionManagement } from './use-collection-management'

afterEach(cleanup)

describe('useCollectionManagement', () => {
  it('creates and persists a normalized collection', async () => {
    const state = createTestState()
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCollectionManagement({ state, save }),
    )

    act(() => {
      result.current.openCreate()
      result.current.updateFormValues({
        name: '  Development  ',
        description: '  Daily tools  ',
        icon: 'code',
        color: '#f97316',
      })
    })
    await act(async () => result.current.submitEditor())

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.calls[0][0].collections[0]).toMatchObject({
      name: 'Development',
      description: 'Daily tools',
      icon: 'code',
      color: '#f97316',
      resources: [],
    })
    expect(result.current.editor).toBeNull()
  })

  it('keeps the editor open and reports an invalid name without saving', async () => {
    const state = createTestState()
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCollectionManagement({ state, save }),
    )

    act(() => {
      result.current.openCreate()
      result.current.updateFormValues({
        name: '   ',
        description: '',
        icon: 'folder',
        color: '#f97316',
      })
    })
    await act(async () => result.current.submitEditor())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.nameError).toBe('Enter a collection name.')
    expect(result.current.editor).toEqual({ mode: 'create' })
  })

  it('edits the latest collection state without losing its resources', async () => {
    const collection = createTestCollection({
      resources: [createTestWebsiteResource()],
    })
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCollectionManagement({ state, save }),
    )

    act(() => {
      result.current.openEdit(collection)
      result.current.updateFormValues({
        name: 'Engineering',
        description: 'Updated collection',
        icon: 'cloud',
        color: '#2563eb',
      })
    })
    await act(async () => result.current.submitEditor())

    const savedCollection = save.mock.calls[0][0].collections[0]
    expect(savedCollection.name).toBe('Engineering')
    expect(savedCollection.resources).toEqual(collection.resources)
  })

  it('deletes only after confirmation', async () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCollectionManagement({ state, save }),
    )

    act(() => result.current.requestDelete(collection))
    act(() => result.current.cancelDelete())
    expect(save).not.toHaveBeenCalled()

    act(() => result.current.requestDelete(collection))
    await act(async () => result.current.confirmDelete())

    expect(save).toHaveBeenCalledWith({
      ...state,
      collections: [],
    })
    expect(result.current.collectionToDelete).toBeNull()
  })

  describe('deleting a collection that holds file resources', () => {
    function createFileContent() {
      const remove = vi.fn((id: string) => {
        void id
        return Promise.resolve()
      })

      return { adapter: { remove } as unknown as FileContentAdapter, remove }
    }

    function createSave() {
      return vi
        .fn<(nextState: CollectionsState) => Promise<void>>()
        .mockResolvedValue(undefined)
    }

    it('removes the stored content of every file inside it, and only those', async () => {
      const collection = createTestCollection({
        resources: [
          createTestWebsiteResource({ id: 'w1' }),
          createTestFileResource({ id: 'f1', name: 'One' }),
          createTestFileResource({ id: 'f2', name: 'Two' }),
        ],
      })
      const other = createTestCollection({
        id: 'other',
        name: 'Other',
        resources: [createTestFileResource({ id: 'keep', name: 'Keep' })],
      })
      const state = createTestState({ collections: [collection, other] })
      const { adapter, remove } = createFileContent()
      const { result } = renderHook(() =>
        useCollectionManagement({ state, save: createSave(), fileContent: adapter }),
      )

      act(() => result.current.requestDelete(collection))
      await act(async () => result.current.confirmDelete())

      expect(remove).toHaveBeenCalledTimes(2)
      expect(remove).toHaveBeenCalledWith('f1')
      expect(remove).toHaveBeenCalledWith('f2')
      expect(remove).not.toHaveBeenCalledWith('keep')
      expect(result.current.collectionToDelete).toBeNull()
    })

    it('keeps the stored content, and reports an error, when saving the deletion fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const collection = createTestCollection({
        resources: [createTestFileResource()],
      })
      const state = createTestState({ collections: [collection] })
      const save = vi
        .fn<(nextState: CollectionsState) => Promise<void>>()
        .mockRejectedValue(new Error('Storage unavailable'))
      const { adapter, remove } = createFileContent()
      const { result } = renderHook(() =>
        useCollectionManagement({ state, save, fileContent: adapter }),
      )

      act(() => result.current.requestDelete(collection))
      await act(async () => result.current.confirmDelete())

      expect(remove).not.toHaveBeenCalled()
      expect(result.current.deleteError).toBe(
        'The collection could not be deleted. Try again.',
      )
    })

    it('still completes the deletion if removing stored content fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const collection = createTestCollection({
        resources: [createTestFileResource()],
      })
      const state = createTestState({ collections: [collection] })
      const { adapter, remove } = createFileContent()
      remove.mockRejectedValueOnce(new Error('cleanup failed'))
      const { result } = renderHook(() =>
        useCollectionManagement({ state, save: createSave(), fileContent: adapter }),
      )

      act(() => result.current.requestDelete(collection))
      await act(async () => result.current.confirmDelete())

      expect(result.current.deleteError).toBeUndefined()
      expect(result.current.collectionToDelete).toBeNull()
    })
  })

  it('reports a name conflict under the name field instead of the generic form error', async () => {
    const existing = createTestCollection({ name: 'Development' })
    const state = createTestState({ collections: [existing] })
    const save = vi.fn<(nextState: CollectionsState) => Promise<void>>()
    const { result } = renderHook(() =>
      useCollectionManagement({ state, save }),
    )

    act(() => {
      result.current.openCreate()
      result.current.updateFormValues({
        name: 'development',
        description: '',
        icon: 'folder',
        color: '#f97316',
      })
    })
    await act(async () => result.current.submitEditor())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.nameError).toBe(
      'A collection with this name already exists.',
    )
    expect(result.current.formError).toBeUndefined()
    expect(result.current.editor).toEqual({ mode: 'create' })
  })

  it('preserves entered values when persistence fails', async () => {
    const state = createTestState()
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockRejectedValue(new Error('Storage unavailable'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useCollectionManagement({ state, save }),
    )
    const enteredValues = {
      name: 'Research',
      description: 'Articles to read',
      icon: 'search',
      color: '#8b5cf6',
    }

    act(() => {
      result.current.openCreate()
      result.current.updateFormValues(enteredValues)
    })
    await act(async () => result.current.submitEditor())

    expect(result.current.editor).toEqual({ mode: 'create' })
    expect(result.current.formValues).toEqual(enteredValues)
    expect(result.current.formError).toBe(
      'The collection could not be saved. Try again.',
    )
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
