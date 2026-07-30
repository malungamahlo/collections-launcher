import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

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
    permissions: ['storage'],
  },
  webExt: {
    startUrls: ['chrome://newtab/'],
  },
})
