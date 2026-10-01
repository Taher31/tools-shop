import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS needs decorator metadata, which esbuild does not emit.
  plugins: [swc.vite({ module: { type: 'es6' }, jsc: { target: 'es2022' } })],
  test: {
    // Integration specs share one database, so files run one after another.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['test/unit/**/*.spec.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.spec.ts'],
          environment: 'node',
          globalSetup: ['test/integration/global-setup.ts'],
          setupFiles: ['test/integration/env.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
