import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/smoke/**/*.smoke.test.ts'],
    // The races need real concurrency against one API, so the file's tests stay in one process.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
