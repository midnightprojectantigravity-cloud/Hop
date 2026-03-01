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

describe('biome sandbox preview state', () => {
  it('builds deterministic preview states for identical inputs', () => {
    const a = buildPreviewState('inferno', 'preview-seed-1', true, baseWalls);
    const b = buildPreviewState('inferno', 'preview-seed-1', true, baseWalls);

    expect(a.floor).toBe(b.floor);
    expect(a.player.position).toEqual(b.player.position);
    expect(Array.from(a.tiles.keys())).toEqual(Array.from(b.tiles.keys()));
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

