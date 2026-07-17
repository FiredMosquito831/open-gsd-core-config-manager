import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'node',
    watch: false,
    passWithNoTests: true,
    pool: 'vmThreads',
  },
});
