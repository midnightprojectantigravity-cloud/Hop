import { describe, expect, it } from 'vitest';
import { pointToKey } from '@hop/engine';
import { buildPreviewState } from '../components/biome-sandbox/state/preview-state';
import type { WallSettings } from '../components/biome-sandbox/types';

const baseWalls: WallSettings = {
  mode: 'native',
  interiorDensity: 0.05,
  clusterBias: 0.1,
  keepPerimeter: true,
  mountainPath: '',
  mountainScale: 0.5,
  mountainOffsetX: 0,
  mountainOffsetY: 0,
  mountainAnchorX: 0.5,
  mountainAnchorY: 0.5,
  mountainCrustBlendMode: 'multiply',
  mountainCrustBlendOpacity: 1,
  mountainTintColor: '#777777',
  mountainTintBlendMode: 'overlay',
  mountainTintOpacity: 1
};

const NON_VOID_THEMES = ['inferno', 'throne', 'frozen', 'catacombs'] as const;
const SANDBOX_THEMES = ['inferno', 'void', 'throne', 'frozen', 'catacombs'] as const;

describe('biome sandbox preview state', () => {
  it('builds deterministic preview states for identical inputs', () => {
    const a = buildPreviewState('inferno', 'preview-seed-1', true, baseWalls);
    const b = buildPreviewState('inferno', 'preview-seed-1', true, baseWalls);

    expect(a.floor).toBe(b.floor);
    expect(a.player.position).toEqual(b.player.position);
    expect(Array.from(a.tiles.keys())).toEqual(Array.from(b.tiles.keys()));
  });

  it('uses a canonical preview layout across sandbox themes', () => {
    const states = SANDBOX_THEMES.map((theme) => buildPreviewState(theme, 'preview-layout-seed', false, baseWalls));
    const [baseline, ...others] = states;
    const baselineTileKeys = Array.from(baseline.tiles.keys());

    for (const state of states) {
      expect(state.floor).toBe(4);
      expect(state.contentTheme).toBe('inferno');
    }

    for (const state of others) {
      expect(Array.from(state.tiles.keys())).toEqual(baselineTileKeys);
      expect(state.player.position).toEqual(baseline.player.position);
      expect(state.stairsPosition).toEqual(baseline.stairsPosition);
      expect(state.shrinePosition).toEqual(baseline.shrinePosition);
    }
  });

  it('materializes non-void hazards as lava with fire accents', () => {
    for (const theme of NON_VOID_THEMES) {
      const state = buildPreviewState(theme, 'preview-seed-1', true, baseWalls);
      const hazardTile = Array.from(state.tiles.values()).find((tile) =>
        tile.traits.has('LAVA') || tile.traits.has('TOXIC')
      );

      expect(hazardTile?.traits.has('LAVA')).toBe(true);
      expect(hazardTile?.traits.has('TOXIC')).toBe(false);
      expect(Array.from(state.tiles.values()).some((tile) => tile.traits.has('FIRE'))).toBe(true);
    }
  });

  it('materializes void hazards as toxic without inferno fire accents', () => {
    const state = buildPreviewState('void', 'preview-seed-1', true, baseWalls);
    const hazardTile = Array.from(state.tiles.values()).find((tile) =>
      tile.traits.has('LAVA') || tile.traits.has('TOXIC')
    );

    expect(hazardTile?.traits.has('TOXIC')).toBe(true);
    expect(hazardTile?.traits.has('LAVA')).toBe(false);
    expect(Array.from(state.tiles.values()).some((tile) => tile.traits.has('FIRE'))).toBe(false);
  });

  it('keeps spawn tile walkable when synthetic walls are enabled', () => {
    const state = buildPreviewState('inferno', 'preview-seed-2', false, {
      ...baseWalls,
      mode: 'custom',
      interiorDensity: 0.45,
      clusterBias: 1,
      keepPerimeter: true
    });

    const spawnKey = pointToKey(state.player.position);
    const spawnTile = state.tiles.get(spawnKey);
    expect(spawnTile).toBeDefined();
    expect(spawnTile!.traits.has('BLOCKS_MOVEMENT')).toBe(false);
  });
});
