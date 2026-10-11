import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserStorageQuotaAdapter } from './storage-quota.adapter'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubStorage(storage: Partial<StorageManager> | undefined): void {
  vi.stubGlobal('navigator', { storage })
}

describe('BrowserStorageQuotaAdapter', () => {
  describe('estimate', () => {
    it('reports what the browser estimates', async () => {
      stubStorage({ estimate: () => Promise.resolve({ quota: 1_000, usage: 250 }) })

      expect(await new BrowserStorageQuotaAdapter().estimate()).toEqual({
        quota: 1_000,
        usage: 250,
      })
    })

    it.each([
      ['there is no Storage API', undefined],
      ['the Storage API cannot estimate', {}],
      ['estimating fails', { estimate: () => Promise.reject(new Error('no')) }],
    ])('is undefined, not an error, when %s', async (_label, storage) => {
      stubStorage(storage)

      expect(await new BrowserStorageQuotaAdapter().estimate()).toBeUndefined()
    })
  })

  describe('persist', () => {
    it('asks the browser to keep what is stored, and reports that it will', async () => {
      const persist = vi.fn(() => Promise.resolve(true))
      stubStorage({ persisted: () => Promise.resolve(false), persist })

      expect(await new BrowserStorageQuotaAdapter().persist()).toBe(true)
      expect(persist).toHaveBeenCalledOnce()
    })

    it('does not ask again when storage is already persistent', async () => {
      const persist = vi.fn(() => Promise.resolve(true))
      stubStorage({ persisted: () => Promise.resolve(true), persist })

      expect(await new BrowserStorageQuotaAdapter().persist()).toBe(true)
      expect(persist).not.toHaveBeenCalled()
    })

    it('reports a refusal without treating it as an error', async () => {
      stubStorage({
        persisted: () => Promise.resolve(false),
        persist: () => Promise.resolve(false),
      })

      expect(await new BrowserStorageQuotaAdapter().persist()).toBe(false)
    })

    it.each([
      ['there is no Storage API', undefined],
      ['the Storage API cannot persist', {}],
      ['asking fails', { persist: () => Promise.reject(new Error('no')) }],
    ])('is false, not an error, when %s', async (_label, storage) => {
      stubStorage(storage)

      expect(await new BrowserStorageQuotaAdapter().persist()).toBe(false)
    })
  })
})
