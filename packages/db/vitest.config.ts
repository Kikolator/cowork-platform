import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
    reporters: ['verbose'],
    globalSetup: ['tests/rls/global-setup.ts'],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
