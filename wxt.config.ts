import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'

const chromiumProfile = fileURLToPath(
  new URL('./.wxt/chromium-profile/', import.meta.url),
)

// WXT gives NODE_ENV the value of the build *mode* when it isn't set, and Vite
// only treats a build as production when NODE_ENV is `production`. So a build in
// a custom mode (`--mode e2e`) would bundle React's development build and the
// development exports of packages such as micromark. Every `wxt build` is a
// production build; only the manifest differs between modes (see below).
if (process.argv.includes('build')) {
  process.env.NODE_ENV = 'production'
}

/**
 * What opening a Word, Excel, or PowerPoint file needs: a temporary copy is
 * written where the operating system can open it (`downloads`, `downloads.open`)
 * without Chrome's download bubble showing (`downloads.ui`). Chrome words all
 * three as "Manage your downloads".
 *
 * They are *optional*: the extension asks for them the first time someone opens
 * an Office file, so nobody who never does sees the warning. Keep this list in
 * step with `BrowserExternalOpenAdapter`.
 */
const DOWNLOAD_PERMISSIONS = ['downloads', 'downloads.open', 'downloads.ui']

export default defineConfig({
  alias: {
    '@app': 'src',
  },
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: ({ mode }) => {
    // The end-to-end build (`npm run build:e2e`, output `chrome-mv3-e2e`) has the
    // downloads permissions from the start, because a test cannot click Chrome's
    // permission prompt. Nothing else about it differs from the real build.
    const isEndToEndBuild = mode === 'e2e'

    return {
      name: 'Collections Launcher',
      description: 'Organize websites into reusable collections.',
      permissions: [
        'storage',
        'activeTab',
        'bookmarks',
        ...(isEndToEndBuild ? DOWNLOAD_PERMISSIONS : []),
      ],
      optional_permissions: isEndToEndBuild ? [] : DOWNLOAD_PERMISSIONS,
      commands: {
        _execute_action: {
          suggested_key: {
            default: 'Ctrl+Shift+S',
            mac: 'Command+Shift+S',
          },
          description: 'Save the current page to a collection',
        },
      },
    }
  },
  webExt: {
    // Keep local extension storage across managed Chrome restarts in development.
    chromiumProfile,
    keepProfileChanges: true,
    startUrls: ['chrome://newtab/'],
  },
})
