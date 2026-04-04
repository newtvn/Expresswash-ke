import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Ordered: auth → customer → driver → admin (each suite depends on the previous)
    include: [
      'src/test/integration/auth.integration.test.ts',
      'src/test/integration/customer.integration.test.ts',
      'src/test/integration/driver.integration.test.ts',
      'src/test/integration/admin.integration.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // NO setupFiles — we use a real Supabase client, not mocks
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Run files sequentially — they share state via globalThis (customer → driver → admin)
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
