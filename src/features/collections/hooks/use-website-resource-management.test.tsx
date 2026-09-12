// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectionsState } from '../model/collection.types'
import {
  createTestCollection,
  createTestState,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { useWebsiteResourceManagement } from './use-website-resource-management'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Creates a typed successful persistence mock. */
function createSaveMock() {
  return vi
    .fn<(state: CollectionsState) => Promise<void>>()
    .mockResolvedValue(undefined)
}

describe('useWebsiteResourceManagement', () => {
  it('creates a normalized website and updates its collection timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )

    act(() => {
      result.current.openCreate(collection)
      result.current.updateFormValues({
        name: '  Example  ',
        url: ' example.com ',
        collectionId: collection.id,
      })
    })
    await act(async () => result.current.submitEditor())

    const savedCollection = save.mock.calls[0][0].collections[0]
    expect(savedCollection?.updatedAt).toBe(2_000)
    expect(savedCollection?.resources[0]).toMatchObject({
      name: 'Example',
      url: 'https://example.com/',
      createdAt: 2_000,
      updatedAt: 2_000,
    })
    expect(result.current.editor).toBeNull()
  })

  it('reports name and URL validation without saving', async () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )

    act(() => {
      result.current.openCreate(collection)
      result.current.updateFormValues({
        name: ' ',
        url: 'ftp://example.com',
        collectionId: collection.id,
      })
    })
    await act(async () => result.current.submitEditor())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.nameError).toBe('Enter a resource name.')
    expect(result.current.urlError).toBe(
      'Resource URL must use HTTP or HTTPS.',
    )
    expect(result.current.editor).toEqual({ mode: 'create' })
  })

  it('rejects a duplicate normalized URL without losing form values', async () => {
    const existingResource = createTestWebsiteResource()
    const collection = createTestCollection({
      resources: [existingResource],
    })
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )
    const enteredValues = {
      name: 'GitHub again',
      url: 'github.com',
      collectionId: collection.id,
    }

    act(() => {
      result.current.openCreate(collection)
      result.current.updateFormValues(enteredValues)
    })
    await act(async () => result.current.submitEditor())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.urlError).toBe(
      'This resource is already saved in that collection.',
    )
    expect(result.current.formValues).toEqual(enteredValues)
    expect(result.current.editor).toEqual({ mode: 'create' })
  })

  it('rejects a duplicate resource name without losing form values', async () => {
    const existingResource = createTestWebsiteResource()
    const collection = createTestCollection({
      resources: [existingResource],
    })
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )
    const enteredValues = {
      name: existingResource.name,
      url: 'https://example.com/',
      collectionId: collection.id,
    }

    act(() => {
      result.current.openCreate(collection)
      result.current.updateFormValues(enteredValues)
    })
    await act(async () => result.current.submitEditor())

    expect(save).not.toHaveBeenCalled()
    expect(result.current.nameError).toBe(
      'A resource with this name already exists in that collection.',
    )
    expect(result.current.formValues).toEqual(enteredValues)
    expect(result.current.editor).toEqual({ mode: 'create' })
  })

  it('edits and moves a website while updating both collection timestamps', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const resource = createTestWebsiteResource()
    const source = createTestCollection({ resources: [resource] })
    const target = createTestCollection({
      id: 'collection-2',
      name: 'Research',
    })
    const state = createTestState({ collections: [source, target] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )

    act(() => {
      result.current.openEdit(source, resource)
      result.current.updateFormValues({
        name: 'Example docs',
        url: 'example.com/docs',
        collectionId: target.id,
      })
    })
    await act(async () => result.current.submitEditor())

    const savedState = save.mock.calls[0][0]
    expect(savedState.collections[0]).toMatchObject({
      resources: [],
      updatedAt: 2_000,
    })
    expect(savedState.collections[1]?.updatedAt).toBe(2_000)
    expect(savedState.collections[1]?.resources[0]).toMatchObject({
      id: resource.id,
      name: 'Example docs',
      url: 'https://example.com/docs',
      createdAt: resource.createdAt,
      updatedAt: 2_000,
    })
  })

  it('cancels deletion without saving and removes only after confirmation', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000)
    const resource = createTestWebsiteResource()
    const collection = createTestCollection({ resources: [resource] })
    const state = createTestState({ collections: [collection] })
    const save = createSaveMock()
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )

    act(() => result.current.requestDelete(collection, resource))
    act(() => result.current.cancelDelete())
    expect(save).not.toHaveBeenCalled()

    act(() => result.current.requestDelete(collection, resource))
    await act(async () => result.current.confirmDelete())

    expect(save.mock.calls[0][0].collections[0]).toMatchObject({
      resources: [],
      updatedAt: 2_000,
    })
    expect(result.current.resourceToDelete).toBeNull()
  })

  it('preserves entered values when storage persistence fails', async () => {
    const collection = createTestCollection()
    const state = createTestState({ collections: [collection] })
    const save = vi
      .fn<(nextState: CollectionsState) => Promise<void>>()
      .mockRejectedValue(new Error('Storage unavailable'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { result } = renderHook(() =>
      useWebsiteResourceManagement({ state, save }),
    )
    const enteredValues = {
      name: 'Example',
      url: 'example.com',
      collectionId: collection.id,
    }

    act(() => {
      result.current.openCreate(collection)
      result.current.updateFormValues(enteredValues)
    })
    await act(async () => result.current.submitEditor())

    expect(result.current.editor).toEqual({ mode: 'create' })
    expect(result.current.formValues).toEqual(enteredValues)
    expect(result.current.formError).toBe(
      'The resource could not be saved. Try again.',
    )
    expect(consoleError).toHaveBeenCalled()
  })
})
