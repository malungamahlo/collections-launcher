// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '../model/collection.types'
import { createTestCollection } from '../test/collection.fixtures'
import { useAddResource } from './use-add-resource'

afterEach(() => {
  cleanup()
})

const first = createTestCollection({ id: 'first', name: 'Development' })
const second = createTestCollection({ id: 'second', name: 'Research' })

/**
 * Stand-ins for the two form hooks. They keep their own state, as the real
 * ones do, so a test re-renders the coordinator to see the effect.
 */
function createControls() {
  const websites = {
    editor: null as { mode: 'create' | 'edit' } | null,
    formValues: { collectionId: '' },
    isSaving: false,
    openCreate: vi.fn((collection: Collection) => {
      websites.editor = { mode: 'create' }
      websites.formValues = { collectionId: collection.id }
    }),
    closeEditor: vi.fn(() => {
      websites.editor = null
    }),
  }
  const files = {
    isOpen: false,
    formValues: { collectionId: '' },
    isSaving: false,
    isPicking: false,
    openCreate: vi.fn((collection: Collection) => {
      files.isOpen = true
      files.formValues = { collectionId: collection.id }
    }),
    close: vi.fn(() => {
      files.isOpen = false
    }),
  }

  return { websites, files }
}

function renderCoordinator(collections: readonly Collection[] = [first, second]) {
  const controls = createControls()
  const rendered = renderHook(() =>
    useAddResource({ ...controls, collections }),
  )

  return { ...rendered, ...controls }
}

describe('useAddResource', () => {
  it('starts closed, on the website type', () => {
    const { result } = renderCoordinator()

    expect(result.current.isOpen).toBe(false)
    expect(result.current.type).toBe('website')
  })

  it('opens on the website form for the collection whose card was used', () => {
    const { result, rerender, websites, files } = renderCoordinator()

    act(() => result.current.open(second))
    rerender()

    expect(websites.openCreate).toHaveBeenCalledWith(second)
    expect(files.openCreate).not.toHaveBeenCalled()
    expect(result.current.isOpen).toBe(true)
    expect(result.current.type).toBe('website')
  })

  it('switches to the file form for the same collection, closing the website form', () => {
    const { result, rerender, websites, files } = renderCoordinator()
    act(() => result.current.open(second))
    rerender()

    act(() => result.current.selectType('file'))
    rerender()

    expect(websites.closeEditor).toHaveBeenCalledOnce()
    expect(files.openCreate).toHaveBeenCalledWith(second)
    expect(result.current.type).toBe('file')
    expect(result.current.isOpen).toBe(true)
  })

  it('switches back to the website form, closing the file form, for the same collection', () => {
    const { result, rerender, websites, files } = renderCoordinator()
    act(() => result.current.open(second))
    rerender()
    act(() => result.current.selectType('file'))
    rerender()

    act(() => result.current.selectType('website'))
    rerender()

    expect(files.close).toHaveBeenCalledOnce()
    expect(websites.openCreate).toHaveBeenLastCalledWith(second)
    expect(result.current.type).toBe('website')
  })

  it('uses the collection currently chosen in the form, not the one it was opened on', () => {
    const { result, rerender, websites, files } = renderCoordinator()
    act(() => result.current.open(first))
    rerender()
    websites.formValues = { collectionId: 'second' }
    rerender()

    act(() => result.current.selectType('file'))

    expect(files.openCreate).toHaveBeenCalledWith(second)
  })

  it('does nothing when the type is already selected', () => {
    const { result, rerender, websites, files } = renderCoordinator()
    act(() => result.current.open(first))
    rerender()

    act(() => result.current.selectType('website'))

    expect(websites.closeEditor).not.toHaveBeenCalled()
    expect(files.openCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['a website is being saved', (controls: ReturnType<typeof createControls>) => { controls.websites.isSaving = true }],
    ['a file is being saved', (controls: ReturnType<typeof createControls>) => { controls.files.isSaving = true }],
    ['the file picker is open', (controls: ReturnType<typeof createControls>) => { controls.files.isPicking = true }],
  ])('refuses to switch while %s', (_description, makeBusy) => {
    const coordinator = renderCoordinator()
    act(() => coordinator.result.current.open(first))
    coordinator.rerender()
    makeBusy(coordinator)
    coordinator.rerender()

    expect(coordinator.result.current.isBusy).toBe(true)

    act(() => coordinator.result.current.selectType('file'))

    expect(coordinator.websites.closeEditor).not.toHaveBeenCalled()
    expect(coordinator.files.openCreate).not.toHaveBeenCalled()
    expect(coordinator.result.current.type).toBe('website')
  })

  it('stays put if the collection was deleted while the dialog was open', () => {
    const controls = createControls()
    let collections: readonly Collection[] = [first]
    const { result, rerender } = renderHook(() =>
      useAddResource({ ...controls, collections }),
    )
    act(() => result.current.open(first))
    rerender()
    collections = []
    rerender()

    act(() => result.current.selectType('file'))

    expect(controls.files.openCreate).not.toHaveBeenCalled()
    expect(controls.websites.closeEditor).not.toHaveBeenCalled()
    expect(result.current.type).toBe('website')
  })

  it('does not count editing a website as the add dialog being open', () => {
    const { result, rerender, websites } = renderCoordinator()

    websites.editor = { mode: 'edit' }
    rerender()

    expect(result.current.isOpen).toBe(false)
  })

  it('closes whichever form is open', () => {
    const { result, rerender, websites, files } = renderCoordinator()
    act(() => result.current.open(first))
    rerender()
    act(() => result.current.selectType('file'))
    rerender()

    act(() => result.current.close())
    rerender()

    expect(websites.closeEditor).toHaveBeenCalled()
    expect(files.close).toHaveBeenCalled()
    expect(result.current.isOpen).toBe(false)
  })

  it('reopens on the website type even after last being on the file type', () => {
    const { result, rerender } = renderCoordinator()
    act(() => result.current.open(first))
    rerender()
    act(() => result.current.selectType('file'))
    rerender()
    act(() => result.current.close())
    rerender()

    act(() => result.current.open(second))
    rerender()

    expect(result.current.type).toBe('website')
  })
})
