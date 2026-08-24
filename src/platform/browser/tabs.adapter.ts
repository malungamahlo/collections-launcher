import { browser } from 'wxt/browser'

/**
 * Defines browser-tab behavior needed by application code.
 */
export interface TabsAdapter {
  open(url: string): Promise<void>
  openMany(urls: readonly string[]): Promise<void>
}

/**
 * Opens websites through the WebExtension tabs API.
 */
export class BrowserTabsAdapter implements TabsAdapter {
  async open(url: string): Promise<void> {
    await browser.tabs.create({
      url,
      active: true,
    })
  }

  /** Opens websites in saved order, activating the first created tab. */
  async openMany(urls: readonly string[]): Promise<void> {
    for (const [index, url] of urls.entries()) {
      await browser.tabs.create({
        url,
        active: index === 0,
      })
    }
  }
}
