import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      // The app imports through the `@/` alias; tests have to resolve it the same way.
      '@': path.resolve(import.meta.dirname),
      // `server-only` exists to fail the build if a module is pulled into the browser
      // bundle. Vitest is neither, so it throws on import and takes the server modules
      // out of reach of testing entirely. Stubbing it keeps the guard where it matters,
      // in the bundler, while letting the tests reach the code it protects.
      'server-only': path.resolve(import.meta.dirname, 'lib/test/server-only-stub.ts'),
    },
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
})
