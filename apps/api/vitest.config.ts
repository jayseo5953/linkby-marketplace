import { defineConfig } from 'vitest/config';

// Narrowed to `src` so the smoke suite, which needs a running stack, cannot join this run.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
