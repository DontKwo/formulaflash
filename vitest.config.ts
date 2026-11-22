import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@formulaflash/core': path.resolve(__dirname, 'packages/core/index.ts'),
    },
  },
  test: {
    include: [
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/fixtures/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'apps/app/src/data/**/*.{test,spec}.{ts,tsx}',
      'apps/app/src/export/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
});
