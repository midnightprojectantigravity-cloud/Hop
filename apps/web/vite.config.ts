import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const bundleStatsPlugin = (): Plugin => ({
  name: 'hop-bundle-stats',
  apply: 'build',
  generateBundle(_options, bundle) {
    const chunkStats = Object.values(bundle)
      .filter((entry): entry is import('rollup').OutputChunk => entry.type === 'chunk')
      .map((chunk) => ({
        fileName: chunk.fileName,
        name: chunk.name,
        isEntry: chunk.isEntry,
        isDynamicEntry: chunk.isDynamicEntry,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        modules: Object.keys(chunk.modules),
        renderedLength: chunk.code.length
      }))
      .sort((a, b) => b.renderedLength - a.renderedLength);

    const assetStats = Object.values(bundle)
      .filter((entry): entry is import('rollup').OutputAsset => entry.type === 'asset')
      .map((asset) => ({
        fileName: asset.fileName,
        sourceLength: typeof asset.source === 'string' ? asset.source.length : asset.source.byteLength
      }))
      .sort((a, b) => b.sourceLength - a.sourceLength);

    this.emitFile({
      type: 'asset',
      fileName: 'bundle-stats.json',
      source: JSON.stringify({
        generatedAt: new Date().toISOString(),
        chunks: chunkStats,
        assets: assetStats
      }, null, 2)
    });
  }
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@hop/engine': path.resolve(__dirname, '../../packages/engine/src')
    }
  },
  plugins: [
    react(),
    ...(mode === 'analyze' ? [bundleStatsPlugin()] : [])
  ],
  root: '.',
  base: '/Hop/',
  worker: {
    format: 'es'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.split(path.sep).join('/');

          if (normalized.includes('/node_modules/react/')) return 'vendor-react';
          if (normalized.includes('/node_modules/react-dom/')) return 'vendor-react-dom';
          if (normalized.includes('/node_modules/')) return 'vendor-misc';

          if (normalized.includes('/packages/engine/src/data/')) return 'engine-data';
          if (normalized.includes('/packages/engine/src/generation/')) return 'engine-generation';
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
    strictPort: true
  }
}))
