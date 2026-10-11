import { describe, expect, it, vi } from 'vitest'
import {
  BrowserFileContentAdapter,
  FileContentError,
  type FileContentStore,
  type StoredFileContent,
} from './file-content.adapter'

/** An in-memory `FileContentStore`, so adapter logic is tested without IndexedDB. */
function createMemoryStore(): FileContentStore & {
  readonly entries: Map<string, StoredFileContent>
} {
  const entries = new Map<string, StoredFileContent>()

  return {
    entries,
    get: id => Promise.resolve(entries.get(id)),
    put: (id, content) => {
      entries.set(id, content)
      return Promise.resolve()
    },
    delete: id => {
      entries.delete(id)
      return Promise.resolve()
    },
  }
}

function domError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

interface FakeHandleOptions {
  readonly name?: string
  readonly file?: File | (() => Promise<File>)
  readonly permission?: PermissionState
  readonly requestResult?: PermissionState | Error
}

/** A stand-in for a `FileSystemFileHandle` with the Chrome permission methods. */
function createFakeHandle(options: FakeHandleOptions = {}) {
  const {
    name = 'notes.md',
    file = new File(['# Notes'], name, { type: 'text/markdown' }),
    permission = 'granted',
    requestResult = 'granted',
  } = options

  const queryPermission = vi.fn().mockResolvedValue(permission)
  const requestPermission = vi.fn(() =>
    requestResult instanceof Error
      ? Promise.reject(requestResult)
      : Promise.resolve(requestResult),
  )
  const getFile = vi.fn(() =>
    typeof file === 'function' ? file() : Promise.resolve(file),
  )

  return {
    handle: {
      kind: 'file',
      name,
      queryPermission,
      requestPermission,
      getFile,
    } as unknown as FileSystemFileHandle,
    queryPermission,
    requestPermission,
    getFile,
  }
}

/**
 * Puts a reference-style entry straight into an adapter's store. Nothing in
 * the app writes one any more — a collection owns a copy of each file — but
 * files added before that are stored this way and must still be read.
 */
async function seedReference(
  adapter: BrowserFileContentAdapter,
  id: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  await (adapter as unknown as { store: FileContentStore }).store.put(id, {
    kind: 'handle',
    handle,
  })
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }

  throw new Error('Expected the promise to reject')
}

describe('BrowserFileContentAdapter', () => {
  describe('blob backend', () => {
    it('loads back the blob it was given', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const blob = new Blob(['hello'], { type: 'text/plain' })

      await adapter.saveBlob('resource-1', blob)

      const loaded = await adapter.load('resource-1')
      expect(loaded).toBe(blob)
      expect(await loaded.text()).toBe('hello')
    })

    it('stores it as a copy of the bytes, not a reference', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)

      await adapter.saveBlob('resource-1', new Blob(['x']))

      expect(store.entries.get('resource-1')?.kind).toBe('blob')
    })
  })

  describe('an older file, still stored as a reference', () => {
    it('loads the file through the handle when read access is already granted', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle, queryPermission, requestPermission } = createFakeHandle()
      await seedReference(adapter, 'resource-1', handle)

      const loaded = await adapter.load('resource-1')

      expect(await loaded.text()).toBe('# Notes')
      expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' })
      expect(requestPermission).not.toHaveBeenCalled()
    })

    it('asks for read access when it is not granted, then loads the file', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle, requestPermission } = createFakeHandle({
        permission: 'prompt',
        requestResult: 'granted',
      })
      await seedReference(adapter, 'resource-1', handle)

      const loaded = await adapter.load('resource-1')

      expect(await loaded.text()).toBe('# Notes')
      expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' })
    })

    it('reports PERMISSION_DENIED, without reading the file, when access is refused', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle, getFile } = createFakeHandle({
        permission: 'prompt',
        requestResult: 'denied',
      })
      await seedReference(adapter, 'resource-1', handle)

      const error = await catchError(adapter.load('resource-1'))

      expect(error).toBeInstanceOf(FileContentError)
      expect(error).toMatchObject({ code: 'PERMISSION_DENIED' })
      expect(getFile).not.toHaveBeenCalled()
    })

    it('reports PERMISSION_DENIED when asking is blocked for lack of a user gesture', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle } = createFakeHandle({
        permission: 'prompt',
        requestResult: domError('SecurityError'),
      })
      await seedReference(adapter, 'resource-1', handle)

      await expect(adapter.load('resource-1')).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      })
    })

    it('reports NOT_FOUND when the file has been moved or deleted', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle } = createFakeHandle({
        file: () => Promise.reject(domError('NotFoundError')),
      })
      await seedReference(adapter, 'resource-1', handle)

      await expect(adapter.load('resource-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('reports PERMISSION_DENIED when reading the file is not allowed', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle } = createFakeHandle({
        file: () => Promise.reject(domError('NotAllowedError')),
      })
      await seedReference(adapter, 'resource-1', handle)

      await expect(adapter.load('resource-1')).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      })
    })

    it('reports UNAVAILABLE, keeping the cause, for any other failure', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const cause = new Error('disk on fire')
      const { handle } = createFakeHandle({
        file: () => Promise.reject(cause),
      })
      await seedReference(adapter, 'resource-1', handle)

      const error = await catchError(adapter.load('resource-1'))

      expect(error).toMatchObject({ code: 'UNAVAILABLE', cause })
    })

    it('adopts the file once it has been read: the reference becomes a copy', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      const { handle } = createFakeHandle()
      await seedReference(adapter, 'resource-1', handle)

      await adapter.load('resource-1')

      const stored = store.entries.get('resource-1')
      expect(stored?.kind).toBe('blob')
      expect(stored?.kind === 'blob' && (await stored.blob.text())).toBe('# Notes')
      expect(stored?.kind === 'blob' && stored.blob.type).toBe('text/markdown')
    })

    it('never goes back to the original after that, whatever happens to it', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      let current: File | Error = new File(['as it was added'], 'notes.md')
      const { handle, getFile } = createFakeHandle({
        file: () => (current instanceof Error ? Promise.reject(current) : Promise.resolve(current)),
      })
      await seedReference(adapter, 'resource-1', handle)
      await adapter.load('resource-1')

      // The original is edited, then deleted; the collection's copy is unmoved.
      current = new File(['edited outside the extension'], 'notes.md')
      expect(await (await adapter.load('resource-1')).text()).toBe('as it was added')
      current = domError('NotFoundError')
      expect(await (await adapter.load('resource-1')).text()).toBe('as it was added')

      expect(getFile).toHaveBeenCalledTimes(1)
    })

    it('still returns the file when it could be read but not stored', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      await seedReference(adapter, 'resource-1', createFakeHandle().handle)
      store.put = () => Promise.reject(domError('QuotaExceededError'))

      const loaded = await adapter.load('resource-1')

      expect(await loaded.text()).toBe('# Notes')
      expect(store.entries.get('resource-1')?.kind).toBe('handle')
      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it('leaves the reference in place when the file cannot be read', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      const { handle } = createFakeHandle({
        file: () => Promise.reject(domError('NotFoundError')),
      })
      await seedReference(adapter, 'resource-1', handle)

      await catchError(adapter.load('resource-1'))

      expect(store.entries.get('resource-1')?.kind).toBe('handle')
    })
  })

  describe('adopting without a click', () => {
    it('copies in a referenced file the browser still has access to', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      const { handle, requestPermission } = createFakeHandle()
      await seedReference(adapter, 'resource-1', handle)

      expect(await adapter.adopt('resource-1')).toBe('adopted')

      const stored = store.entries.get('resource-1')
      expect(stored?.kind === 'blob' && (await stored.blob.text())).toBe('# Notes')
      expect(requestPermission).not.toHaveBeenCalled()
    })

    it('never prompts: a file the browser must ask about is left for a click', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      const { handle, requestPermission, getFile } = createFakeHandle({ permission: 'prompt' })
      await seedReference(adapter, 'resource-1', handle)

      expect(await adapter.adopt('resource-1')).toBe('needs-access')

      expect(requestPermission).not.toHaveBeenCalled()
      expect(getFile).not.toHaveBeenCalled()
      expect(store.entries.get('resource-1')?.kind).toBe('handle')
    })

    it('has nothing to do for a file that is already a copy', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      const blob = new Blob(['owned'])
      await adapter.saveBlob('resource-1', blob)

      expect(await adapter.adopt('resource-1')).toBe('already-owned')

      expect(store.entries.get('resource-1')).toEqual({ kind: 'blob', blob })
    })

    it.each([
      ['its original is gone', () => Promise.reject(domError('NotFoundError'))],
      ['its original cannot be read', () => Promise.reject(new Error('disk on fire'))],
    ])('reports a file as unavailable, without throwing, when %s', async (_label, file) => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      await seedReference(adapter, 'resource-1', createFakeHandle({ file }).handle)

      expect(await adapter.adopt('resource-1')).toBe('unavailable')
      expect(store.entries.get('resource-1')?.kind).toBe('handle')
    })

    it('reports a resource with nothing stored as unavailable', async () => {
      expect(await new BrowserFileContentAdapter(createMemoryStore()).adopt('nope')).toBe(
        'unavailable',
      )
    })

    it('does not throw when the store itself fails', async () => {
      const store = createMemoryStore()
      store.get = () => Promise.reject(new Error('database closed'))

      expect(await new BrowserFileContentAdapter(store).adopt('resource-1')).toBe('unavailable')
    })
  })

  describe('however a file is stored', () => {
    it('returns a Blob from load() whichever form a resource is stored in', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      await adapter.saveBlob('imported', new Blob(['imported bytes']))
      await seedReference(adapter, 'local', createFakeHandle().handle)

      expect(await adapter.load('imported')).toBeInstanceOf(Blob)
      expect(await adapter.load('local')).toBeInstanceOf(Blob)
    })

    it('keeps resources independent, keyed by their own id', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      await adapter.saveBlob('a', new Blob(['A']))
      await adapter.saveBlob('b', new Blob(['B']))

      expect(await (await adapter.load('a')).text()).toBe('A')
      expect(await (await adapter.load('b')).text()).toBe('B')
    })

    it('replaces the content when the same id is saved again', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      await adapter.saveBlob('a', new Blob(['old']))
      await adapter.saveBlob('a', new Blob(['new']))

      expect(await (await adapter.load('a')).text()).toBe('new')
    })
  })

  describe('missing and removed content', () => {
    it('reports NOT_FOUND for a resource nothing is stored for', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())

      await expect(adapter.load('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('forgets content once removed', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      await adapter.saveBlob('a', new Blob(['A']))

      await adapter.remove('a')

      await expect(adapter.load('a')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('does not fail when removing a resource with nothing stored', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())

      await expect(adapter.remove('never-saved')).resolves.toBeUndefined()
    })
  })
})
