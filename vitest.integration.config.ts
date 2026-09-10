import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { resolve } from 'path';

class IntegrationJourneySequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const journey = ['auth.integration', 'customer.integration', 'driver.integration', 'admin.integration'];
    return [...files].sort((left, right) => {
      const leftIndex = journey.findIndex((name) => left.moduleId.includes(name));
      const rightIndex = journey.findIndex((name) => right.moduleId.includes(name));
      return leftIndex - rightIndex;
    });
  }
}

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
    sequence: { concurrent: false, sequencer: IntegrationJourneySequencer },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
