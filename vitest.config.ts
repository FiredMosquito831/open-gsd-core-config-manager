import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['test/e2e/**'],
    environment: 'node',
    setupFiles: ['test/web/setup.ts'],
    watch: false,
    passWithNoTests: true,
    // `forks` (not `vmThreads`): vmThreads throws ERR_VM_MODULE_LINK_FAILURE
    // ("module is already linked") on Node 24 and fails before any test runs.
    // forks is the stable pool here and matches the integration-tests script.
    pool: 'forks',
    // WSL cold imports can exceed Vitest's 10s defaults before a hook reaches app setup.
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
