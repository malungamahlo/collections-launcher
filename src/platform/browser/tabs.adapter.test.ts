// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { BrowserTabsAdapter } from './tabs.adapter'

describe('BrowserTabsAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fakeBrowser.reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('navigates the current tab to the given URL', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined)
    const adapter = new BrowserTabsAdapter()

    await adapter.open('https://example.com/')

    expect(assign).toHaveBeenCalledWith('https://example.com/')
  })

  it('opens the rest in the background, then navigates the current tab to the first URL', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined)
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue(undefined)
    const adapter = new BrowserTabsAdapter()

    await adapter.openMany([
      'https://example.com/one',
      'https://example.com/two',
    ])

    expect(createTab).toHaveBeenCalledWith({
      url: 'https://example.com/two',
      active: false,
    })
    expect(assign).toHaveBeenCalledWith('https://example.com/one')
  })

  it('does nothing for an empty list', async () => {
    const assign = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined)
    const createTab = vi
      .spyOn(browser.tabs, 'create')
      .mockResolvedValue(undefined)
    const adapter = new BrowserTabsAdapter()

    await adapter.openMany([])

    expect(assign).not.toHaveBeenCalled()
    expect(createTab).not.toHaveBeenCalled()
  })
})
