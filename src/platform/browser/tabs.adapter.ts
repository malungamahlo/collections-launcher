import { browser } from 'wxt/browser'

/**
 * Defines browser-tab behavior needed by application code.
 */
export interface TabsAdapter {
  open(url: string): Promise<void>
  openMany(urls: readonly string[]): Promise<void>
}

/**
 * Opens websites through the WebExtension tabs API and plain page
 * navigation. Navigating the current tab uses `window.location` rather
 * than `chrome.tabs.update`, since changing an existing tab's URL to an
 * arbitrary origin needs the `tabs` permission or a host permission —
 * neither of which this extension requests — while a page navigating
 * itself needs no permission at all.
 */
export class BrowserTabsAdapter implements TabsAdapter {
  /** Navigates the current tab to the given URL instead of opening a new one. */
  async open(url: string): Promise<void> {
    window.location.assign(url)
  }

  /**
   * Opens the remaining URLs as background tabs first, then navigates the
   * current tab to the first URL last, so tab creation isn't interrupted
   * by this page unloading.
   */
  async openMany(urls: readonly string[]): Promise<void> {
    const [firstUrl, ...restUrls] = urls

    if (!firstUrl) {
      return
    }

    for (const url of restUrls) {
      await browser.tabs.create({ url, active: false })
    }

    window.location.assign(firstUrl)
  }
}
