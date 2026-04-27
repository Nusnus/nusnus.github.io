import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@components': resolve(__dirname, './src/components'),
      '@config': resolve(__dirname, './src/config'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@layouts': resolve(__dirname, './src/layouts'),
      '@lib': resolve(__dirname, './src/lib'),
      '@styles': resolve(__dirname, './src/styles'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'worker/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
    },
  },
});
