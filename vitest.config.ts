import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'engine', include: ['packages/engine/test/**/*.test.ts'] } },
      { test: { name: 'host', include: ['packages/host/test/**/*.test.ts'] } },
      'apps/web',
    ],
  },
});
