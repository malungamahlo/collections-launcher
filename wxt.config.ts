import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: {
    name: 'Collections Launcher',
    description: 'Organize websites into reusable collections.',
  },
  webExt: {
    startUrls: ['chrome://newtab/'],
  },
})
