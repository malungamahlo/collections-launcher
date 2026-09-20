import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { BrowserFileContentAdapter } from './file-content.adapter'
import { IndexedDbFileContentStore } from './indexeddb-file-content.store'

/** A fresh, isolated IndexedDB for each test. */
function createStore(factory: IDBFactory = new IDBFactory()) {
  return new IndexedDbFileContentStore(factory)
}

async function readBlob(content: { kind: string; blob?: Blob } | undefined) {
  return content?.blob?.text()
}

describe('IndexedDbFileContentStore', () => {
  it('returns undefined for an id nothing is stored under', async () => {
    await expect(createStore().get('missing')).resolves.toBeUndefined()
  })

  it('round-trips a blob entry', async () => {
    const store = createStore()

    await store.put('a', { kind: 'blob', blob: new Blob(['hello']) })

    const stored = await store.get('a')
    expect(stored?.kind).toBe('blob')
    expect(await readBlob(stored)).toBe('hello')
  })

  it('keeps the kind discriminant of whatever record it is given', async () => {
    // A real FileSystemFileHandle is a platform object that only a browser can
    // structured-clone, so this uses a plain stand-in purely to show the record
    // shape survives; persisting a real handle is verified manually in Chrome.
    const store = createStore()
    const standIn = { name: 'notes.md' } as unknown as FileSystemFileHandle

    await store.put('a', { kind: 'handle', handle: standIn })

    expect(await store.get('a')).toEqual({
      kind: 'handle',
      handle: { name: 'notes.md' },
    })
  })

  it('replaces the entry when the same id is written again', async () => {
    const store = createStore()

    await store.put('a', { kind: 'blob', blob: new Blob(['old']) })
    await store.put('a', { kind: 'blob', blob: new Blob(['new']) })

    expect(await readBlob(await store.get('a'))).toBe('new')
  })

  it('keeps entries under different ids independent', async () => {
    const store = createStore()

    await store.put('a', { kind: 'blob', blob: new Blob(['A']) })
    await store.put('b', { kind: 'blob', blob: new Blob(['B']) })

    expect(await readBlob(await store.get('a'))).toBe('A')
    expect(await readBlob(await store.get('b'))).toBe('B')
  })

  it('deletes an entry, leaving the others', async () => {
    const store = createStore()
    await store.put('a', { kind: 'blob', blob: new Blob(['A']) })
    await store.put('b', { kind: 'blob', blob: new Blob(['B']) })

    await store.delete('a')

    expect(await store.get('a')).toBeUndefined()
    expect(await readBlob(await store.get('b'))).toBe('B')
  })

  it('does not fail when deleting an id nothing is stored under', async () => {
    await expect(createStore().delete('missing')).resolves.toBeUndefined()
  })

  it('persists across store instances that share one database', async () => {
    const factory = new IDBFactory()

    await createStore(factory).put('a', {
      kind: 'blob',
      blob: new Blob(['durable']),
    })

    expect(await readBlob(await createStore(factory).get('a'))).toBe('durable')
  })

  it('does not share entries between separate databases', async () => {
    await createStore().put('a', { kind: 'blob', blob: new Blob(['A']) })

    await expect(createStore().get('a')).resolves.toBeUndefined()
  })

  it('serves concurrent operations over one connection', async () => {
    const store = createStore()

    await Promise.all([
      store.put('a', { kind: 'blob', blob: new Blob(['A']) }),
      store.put('b', { kind: 'blob', blob: new Blob(['B']) }),
      store.put('c', { kind: 'blob', blob: new Blob(['C']) }),
    ])

    expect(await readBlob(await store.get('b'))).toBe('B')
  })

  it('rejects when the database cannot be opened, and tries again next time', async () => {
    let attempts = 0
    const failingFactory = {
      open() {
        attempts += 1
        const request: {
          error?: Error
          onerror?: () => void
        } = {}

        queueMicrotask(() => {
          request.error = new Error('blocked')
          request.onerror?.()
        })

        return request
      },
    } as unknown as IDBFactory
    const store = new IndexedDbFileContentStore(failingFactory)

    await expect(store.get('a')).rejects.toThrow('blocked')
    await expect(store.get('a')).rejects.toThrow('blocked')

    expect(attempts).toBe(2)
  })
})

describe('BrowserFileContentAdapter on IndexedDB', () => {
  it('stores and loads an imported file end to end', async () => {
    const adapter = new BrowserFileContentAdapter(createStore())

    await adapter.saveBlob('resource-1', new Blob(['# Imported']))

    expect(await (await adapter.load('resource-1')).text()).toBe('# Imported')
  })

  it('forgets removed content', async () => {
    const adapter = new BrowserFileContentAdapter(createStore())
    await adapter.saveBlob('resource-1', new Blob(['x']))

    await adapter.remove('resource-1')

    await expect(adapter.load('resource-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
