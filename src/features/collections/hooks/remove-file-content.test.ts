import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileContentAdapter } from '@app/platform/browser/file-content.adapter'
import {
  createTestFileResource,
  createTestWebsiteResource,
} from '../test/collection.fixtures'
import { removeStoredFileContent } from './remove-file-content'

afterEach(() => {
  vi.restoreAllMocks()
})

function createAdapter(remove = vi.fn((id: string) => {
  void id
  return Promise.resolve()
})) {
  return {
    adapter: { remove } as unknown as FileContentAdapter,
    remove,
  }
}

describe('removeStoredFileContent', () => {
  it('removes the content of every file resource, by id', async () => {
    const { adapter, remove } = createAdapter()

    await removeStoredFileContent(adapter, [
      createTestFileResource({ id: 'f1', name: 'One' }),
      createTestFileResource({ id: 'f2', name: 'Two' }),
    ])

    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith('f1')
    expect(remove).toHaveBeenCalledWith('f2')
  })

  it('skips website resources, which have no stored content', async () => {
    const { adapter, remove } = createAdapter()

    await removeStoredFileContent(adapter, [
      createTestWebsiteResource({ id: 'w1' }),
      createTestFileResource({ id: 'f1' }),
    ])

    expect(remove).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('f1')
  })

  it('does nothing for an empty list or a list of only websites', async () => {
    const { adapter, remove } = createAdapter()

    await removeStoredFileContent(adapter, [])
    await removeStoredFileContent(adapter, [createTestWebsiteResource()])

    expect(remove).not.toHaveBeenCalled()
  })

  it('logs a failure instead of throwing, and still removes the others', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const remove = vi
      .fn((id: string) => {
        void id
        return Promise.resolve()
      })
      .mockRejectedValueOnce(new Error('disk error'))
    const { adapter } = createAdapter(remove)

    await expect(
      removeStoredFileContent(adapter, [
        createTestFileResource({ id: 'f1', name: 'One' }),
        createTestFileResource({ id: 'f2', name: 'Two' }),
      ]),
    ).resolves.toBeUndefined()

    expect(remove).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalledTimes(1)
  })
})
