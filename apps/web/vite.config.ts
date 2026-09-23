import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // В разработке сервер комнат работает отдельно на :3000 — прокси, чтобы адреса совпадали с продом.
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/config.json': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  test: {
    name: 'web',
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
