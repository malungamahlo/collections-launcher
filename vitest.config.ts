import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

/**
 * Configures Vitest with WXT's in-memory extension environment.
 */
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'node',
  },
})
