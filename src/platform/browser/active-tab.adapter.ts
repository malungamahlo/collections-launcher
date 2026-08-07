import { browser } from 'wxt/browser'
import {
  getReadableWebsiteDomain,
  normalizeWebsiteUrl,
  WebsiteUrlError,
} from '@app/features/collections/model/website-url'

/** The saveable details read from the browser's active tab. */
export interface ActivePage {
  readonly title: string
  readonly url: string
}

/** Expected outcomes when inspecting the browser's active tab. */
export type ActivePageResult =
  | { readonly status: 'available'; readonly page: ActivePage }
  | {
      readonly status: 'unavailable'
      readonly reason: 'missing-tab' | 'missing-url' | 'unsupported-url'
    }

/** Defines the browser capability required by active-page capture. */
export interface ActiveTabAdapter {
  getActivePage(): Promise<ActivePageResult>
}

/** Reads the active page through the temporary activeTab permission. */
export class BrowserActiveTabAdapter implements ActiveTabAdapter {
  async getActivePage(): Promise<ActivePageResult> {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (!tab) {
      return { status: 'unavailable', reason: 'missing-tab' }
    }

    if (!tab.url) {
      return { status: 'unavailable', reason: 'missing-url' }
    }

    try {
      const url = normalizeWebsiteUrl(tab.url)

      return {
        status: 'available',
        page: {
          title: tab.title?.trim() || getReadableWebsiteDomain(url),
          url,
        },
      }
    } catch (error) {
      if (
        error instanceof WebsiteUrlError &&
        error.code === 'UNSUPPORTED_PROTOCOL'
      ) {
        return { status: 'unavailable', reason: 'unsupported-url' }
      }

      throw error
    }
  }
}
