import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['test/web/setup.ts'],
    watch: false,
    passWithNoTests: true,
    pool: 'vmThreads',
    // WSL cold imports can exceed Vitest's 10s defaults before a hook reaches app setup.
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
