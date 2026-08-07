import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser, type Browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BrowserActiveTabAdapter } from './active-tab.adapter'

/** Creates a complete browser tab fixture with customizable page details. */
function createBrowserTab(
  overrides: Partial<Browser.tabs.Tab> = {},
): Browser.tabs.Tab {
  return {
    id: 1,
    index: 0,
    windowId: 1,
    highlighted: true,
    active: true,
    pinned: false,
    incognito: false,
    ...overrides,
  } as Browser.tabs.Tab
}

/** Replaces the overloaded tabs query API with a promise-based test result. */
function mockTabQuery(tabs: Browser.tabs.Tab[]) {
  return vi.spyOn(browser.tabs, 'query').mockImplementation(
    (() => Promise.resolve(tabs)) as typeof browser.tabs.query,
  )
}

describe('BrowserActiveTabAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fakeBrowser.reset()
  })

  it('returns the normalized URL and trimmed title of the active tab', async () => {
    const query = mockTabQuery([
      createBrowserTab({
        title: '  Example documentation  ',
        url: 'https://example.com/docs',
      }),
    ])

    const result = await new BrowserActiveTabAdapter().getActivePage()

    expect(query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    })
    expect(result).toEqual({
      status: 'available',
      page: {
        title: 'Example documentation',
        url: 'https://example.com/docs',
      },
    })
  })

  it('uses the readable domain when the active tab has no title', async () => {
    mockTabQuery([
      createBrowserTab({ title: ' ', url: 'https://www.example.com/' }),
    ])

    await expect(
      new BrowserActiveTabAdapter().getActivePage(),
    ).resolves.toEqual({
      status: 'available',
      page: { title: 'example.com', url: 'https://www.example.com/' },
    })
  })

  it('reports missing tab and URL data without throwing', async () => {
    const query = mockTabQuery([])
    const adapter = new BrowserActiveTabAdapter()

    await expect(adapter.getActivePage()).resolves.toEqual({
      status: 'unavailable',
      reason: 'missing-tab',
    })

    query.mockImplementationOnce(
      (() => Promise.resolve([createBrowserTab()])) as typeof browser.tabs.query,
    )
    await expect(adapter.getActivePage()).resolves.toEqual({
      status: 'unavailable',
      reason: 'missing-url',
    })
  })

  it('rejects internal browser pages as unsupported', async () => {
    mockTabQuery([
      createBrowserTab({
        title: 'Extensions',
        url: 'chrome://extensions/',
      }),
    ])

    await expect(
      new BrowserActiveTabAdapter().getActivePage(),
    ).resolves.toEqual({
      status: 'unavailable',
      reason: 'unsupported-url',
    })
  })

  it('propagates unexpected browser API failures', async () => {
    vi.spyOn(browser.tabs, 'query').mockImplementation(
      (() =>
        Promise.reject(
          new Error('Browser unavailable'),
        )) as typeof browser.tabs.query,
    )

    await expect(
      new BrowserActiveTabAdapter().getActivePage(),
    ).rejects.toThrow('Browser unavailable')
  })
})
