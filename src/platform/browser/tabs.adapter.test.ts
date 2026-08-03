import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BrowserTabsAdapter } from './tabs.adapter'

describe('BrowserTabsAdapter', () => {
  beforeEach(() => {
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
})
