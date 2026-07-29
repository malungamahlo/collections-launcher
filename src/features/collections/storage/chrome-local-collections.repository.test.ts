import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { ChromeLocalCollectionsRepository } from './chrome-local-collections.repository'
import { createEmptyCollectionsState } from './stored-collections-state'
import {
  createTestCollection,
  createTestState,
} from '../test/collection.fixtures'

describe('ChromeLocalCollectionsRepository', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('returns an empty state on first use', async () => {
    const repository = new ChromeLocalCollectionsRepository()

    await expect(repository.load()).resolves.toEqual(
      createEmptyCollectionsState(),
    )
  })

  it('saves and loads collection state', async () => {
    const repository = new ChromeLocalCollectionsRepository()
    const state = createTestState({
      collections: [createTestCollection()],
    })

    await repository.save(state)

    await expect(repository.load()).resolves.toEqual(state)
  })

  it('returns an empty state for malformed persisted data', async () => {
    const repository = new ChromeLocalCollectionsRepository()

    await browser.storage.local.set({
      collectionsLauncherState: {
        schemaVersion: 1,
        collections: 'invalid',
      },
    })

    await expect(repository.load()).resolves.toEqual(
      createEmptyCollectionsState(),
    )
  })

  it('notifies subscribers until they unsubscribe', async () => {
    const repository = new ChromeLocalCollectionsRepository()
    const listener = vi.fn()
    const firstState = createTestState({
      collections: [createTestCollection()],
    })
    const secondState = createTestState()
    const unsubscribe = repository.subscribe(listener)

    await repository.save(firstState)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenLastCalledWith(firstState)

    unsubscribe()
    await repository.save(secondState)

    expect(listener).toHaveBeenCalledOnce()
  })
})
