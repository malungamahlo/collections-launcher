import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'wxt'

const chromiumProfile = fileURLToPath(
  new URL('./.wxt/chromium-profile/', import.meta.url),
)

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
  manifest: {
    name: 'Collections Launcher',
    description: 'Organize websites into reusable collections.',
    permissions: ['storage', 'activeTab'],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: 'Save the current page to a collection',
      },
    },
  },
  webExt: {
    // Keep local extension storage across managed Chrome restarts in development.
    chromiumProfile,
    keepProfileChanges: true,
    startUrls: ['chrome://newtab/'],
  },
})
