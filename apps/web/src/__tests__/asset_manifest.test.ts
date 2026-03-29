import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAssetManifestCache, loadAssetManifest } from '../visual/asset-manifest';

afterEach(() => {
  clearAssetManifestCache();
  vi.restoreAllMocks();
});

describe('asset manifest loader', () => {
  it('accepts uppercase asset path segments without falling back to an empty manifest', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        version: '1.0.0',
        gridTopology: 'flat-top-hex',
        tileUnitPx: 256,
        tileAspectRatio: 1.154700538,
        layers: ['ground', 'decal', 'prop', 'unit', 'fx', 'ui'],
        assets: [{
          id: 'unit.enemy.footman.01',
          type: 'unit',
          layer: 'unit',
          recommendedFormat: 'webp',
          path: '/assets/Bestiary/unit.goblin.footman.01.webp',
          width: 512,
          height: 512,
        }],
      }),
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
    });

    const manifest = await loadAssetManifest();

    expect(fetchMock).toHaveBeenCalledWith('/assets/manifest.json');
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets[0]?.path).toBe('/assets/Bestiary/unit.goblin.footman.01.webp');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
