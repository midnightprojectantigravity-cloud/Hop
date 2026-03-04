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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.split(path.sep).join('/');

          if (normalized.includes('/node_modules/react/')) return 'vendor-react';
          if (normalized.includes('/node_modules/react-dom/')) return 'vendor-react-dom';
          if (normalized.includes('/node_modules/')) return 'vendor-misc';

          // Keep engine runtime in a single chunk to avoid cross-chunk ESM TDZ issues
          // from circular imports between engine core/systems modules.
          if (normalized.includes('/packages/engine/src/')) return 'engine';

          if (normalized.includes('/apps/web/src/components/biome-sandbox/')) return 'ui-biome-sandbox';
          if (normalized.includes('/apps/web/src/components/game-board/')) return 'ui-game-board';
          if (normalized.includes('/apps/web/src/components/juice/')) return 'ui-juice';
          if (normalized.includes('/apps/web/src/components/synapse/')) return 'ui-synapse';

          return undefined;
        }
      }
    }
  },
  server: {
    port: 5175,
    strictPort: true,
  }
})
