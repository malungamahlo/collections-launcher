import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BrowserTabsAdapter } from './tabs.adapter'

describe('BrowserTabsAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fakeBrowser.reset()
  })

  it('opens a website in an active browser tab', async () => {
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue(undefined)
    const adapter = new BrowserTabsAdapter()

    await adapter.open('https://example.com/')

    expect(createTab).toHaveBeenCalledWith({
      url: 'https://example.com/',
      active: true,
    })
  })

  it('opens many websites in order with only the first tab active', async () => {
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue(undefined)
    const adapter = new BrowserTabsAdapter()

    await adapter.openMany([
      'https://example.com/one',
      'https://example.com/two',
    ])

    expect(createTab.mock.calls).toEqual([
      [{ url: 'https://example.com/one', active: true }],
      [{ url: 'https://example.com/two', active: false }],
    ])
  })

  it('does not create tabs for an empty list', async () => {
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue(undefined)
    const adapter = new BrowserTabsAdapter()

    await adapter.openMany([])

    expect(createTab).not.toHaveBeenCalled()
  })
})
