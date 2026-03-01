import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@hop/engine': path.resolve(__dirname, '../../packages/engine/src')
    }
  },
  plugins: [react()],
  root: '.',
  base: '/Hop',
  server: {
    port: 5175,
    strictPort: true,
  }
})
