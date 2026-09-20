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

  describe('handle backend', () => {
    it('stores a reference, never a copy of the bytes', async () => {
      const store = createMemoryStore()
      const adapter = new BrowserFileContentAdapter(store)
      const { handle, getFile } = createFakeHandle()

      await adapter.saveHandle('resource-1', handle)

      expect(store.entries.get('resource-1')).toEqual({ kind: 'handle', handle })
      expect(getFile).not.toHaveBeenCalled()
    })

    it('loads the file through the handle when read access is already granted', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle, queryPermission, requestPermission } = createFakeHandle()
      await adapter.saveHandle('resource-1', handle)

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
      await adapter.saveHandle('resource-1', handle)

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
      await adapter.saveHandle('resource-1', handle)

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
      await adapter.saveHandle('resource-1', handle)

      await expect(adapter.load('resource-1')).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      })
    })

    it('reports NOT_FOUND when the file has been moved or deleted', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle } = createFakeHandle({
        file: () => Promise.reject(domError('NotFoundError')),
      })
      await adapter.saveHandle('resource-1', handle)

      await expect(adapter.load('resource-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })

    it('reports PERMISSION_DENIED when reading the file is not allowed', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      const { handle } = createFakeHandle({
        file: () => Promise.reject(domError('NotAllowedError')),
      })
      await adapter.saveHandle('resource-1', handle)

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
      await adapter.saveHandle('resource-1', handle)

      const error = await catchError(adapter.load('resource-1'))

      expect(error).toMatchObject({ code: 'UNAVAILABLE', cause })
    })

    it('reads the current content on every load, never a cached copy', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      let current = new File(['first'], 'notes.md')
      const { handle, getFile } = createFakeHandle({ file: () => Promise.resolve(current) })
      await adapter.saveHandle('resource-1', handle)

      expect(await (await adapter.load('resource-1')).text()).toBe('first')

      current = new File(['edited outside the extension'], 'notes.md')

      expect(await (await adapter.load('resource-1')).text()).toBe(
        'edited outside the extension',
      )
      expect(getFile).toHaveBeenCalledTimes(2)
    })
  })

  describe('both backends behind one interface', () => {
    it('returns a Blob from load() whichever form a resource is stored in', async () => {
      const adapter = new BrowserFileContentAdapter(createMemoryStore())
      await adapter.saveBlob('imported', new Blob(['imported bytes']))
      await adapter.saveHandle('local', createFakeHandle().handle)

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
