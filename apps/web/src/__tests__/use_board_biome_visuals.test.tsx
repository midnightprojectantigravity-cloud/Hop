// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pointToKey, type GameState, type Point } from '@hop/engine';
import { useBoardBiomeVisuals } from '../components/game-board/useBoardBiomeVisuals';
import type { VisualAssetManifest } from '../visual/asset-manifest';

const TILE: Point = { q: 3, r: 4, s: -7 };
const TILE_KEY = pointToKey(TILE);

const gameState = {
  floor: 4,
  theme: 'inferno',
  gridWidth: 9,
  gridHeight: 11,
  mapShape: 'diamond',
  tiles: new Map([
    [TILE_KEY, {
      baseId: 'STONE',
      position: TILE,
      traits: new Set<string>(),
      effects: []
    }]
  ]),
  player: {
    position: TILE
  }
} as unknown as GameState;

const bounds = {
  minX: -100,
  minY: -100,
  width: 200,
  height: 200
};

const buildManifest = (overrides?: {
  scalePx?: number;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  scrollX?: number;
  scrollY?: number;
  durationMs?: number;
}): VisualAssetManifest => ({
  assets: [],
  tileUnitPx: 256,
  biomeLayers: {
    undercurrent: {
      default: '/assets/biomes/biome.red.lava.01.webp',
      mode: 'repeat',
      scalePx: overrides?.scalePx ?? 192,
      opacity: overrides?.opacity ?? 0.62,
      offsetX: overrides?.offsetX ?? 0,
      offsetY: overrides?.offsetY ?? 0,
      scroll: {
        x: overrides?.scrollX ?? 160,
        y: overrides?.scrollY ?? 110,
        durationMs: overrides?.durationMs ?? 92000
      }
    }
  },
  biomeMaterials: {},
  walls: {},
  biomePresets: {
    inferno: {
      biomeLayers: {
        undercurrent: {
          default: '/assets/biomes/biome.red.lava.01.webp',
          mode: 'repeat',
          scalePx: overrides?.scalePx ?? 192,
          opacity: overrides?.opacity ?? 0.62,
          offsetX: overrides?.offsetX ?? 0,
          offsetY: overrides?.offsetY ?? 0,
          scroll: {
            x: overrides?.scrollX ?? 160,
            y: overrides?.scrollY ?? 110,
            durationMs: overrides?.durationMs ?? 92000
          }
        }
      }
    }
  }
} as unknown as VisualAssetManifest);

const toxicTile: Point = { q: 4, r: 4, s: -8 };
const toxicTileKey = pointToKey(toxicTile);

const toxicGameState = {
  ...gameState,
  theme: 'void',
  tiles: new Map([
    [toxicTileKey, {
      baseId: 'TOXIC',
      position: toxicTile,
      traits: new Set<string>(['TOXIC', 'HAZARDOUS', 'LIQUID']),
      effects: []
    }]
  ]),
  player: {
    position: toxicTile
  }
} as unknown as GameState;

const Probe: React.FC<{
  cells?: Point[];
  gameState?: GameState;
  assetManifest: VisualAssetManifest;
  onResolved: (result: ReturnType<typeof useBoardBiomeVisuals>) => void;
}> = ({ cells = [TILE], gameState: activeGameState = gameState, assetManifest, onResolved }) => {
  const result = useBoardBiomeVisuals({
    cells,
    gameState: activeGameState,
    bounds,
    assetManifest,
    biomeDebug: undefined
  });

  React.useEffect(() => {
    onResolved(result);
  }, [onResolved, result]);

  return null;
};

describe('useBoardBiomeVisuals', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  it('revisions the undercurrent pattern id when repeat settings change', async () => {
    const snapshots: Array<ReturnType<typeof useBoardBiomeVisuals>> = [];

    await act(async () => {
      root?.render(
        <Probe
          assetManifest={buildManifest()}
          onResolved={(result) => { snapshots.push(result); }}
        />
      );
    });

    await act(async () => {
      root?.render(
        <Probe
          assetManifest={buildManifest({
            scalePx: 128,
            opacity: 0.45,
            offsetX: 24,
            offsetY: -12,
            scrollX: 60,
            scrollY: 20,
            durationMs: 12000
          })}
          onResolved={(result) => { snapshots.push(result); }}
        />
      );
    });

    const initial = snapshots[0];
    const updated = snapshots[snapshots.length - 1];

    expect(initial.backdropLayerProps.undercurrentScalePx).toBe(192);
    expect(updated.backdropLayerProps.undercurrentScalePx).toBe(128);
    expect(updated.backdropLayerProps.undercurrentOpacity).toBe(0.45);
    expect(updated.backdropLayerProps.undercurrentOffset).toEqual({ x: 24, y: -12 });
    expect(updated.backdropLayerProps.undercurrentScroll).toEqual({ x: 60, y: 20, durationMs: 12000 });
    expect(updated.backdropLayerProps.undercurrentPatternId).not.toBe(initial.backdropLayerProps.undercurrentPatternId);
  });

  it('cuts crust mask holes for toxic tiles so the undercurrent can show through', async () => {
    let latestResult: ReturnType<typeof useBoardBiomeVisuals> | null = null;

    await act(async () => {
      root?.render(
        <Probe
          assetManifest={buildManifest()}
          onResolved={(result) => { latestResult = result; }}
        />
      );
    });

    await act(async () => {
      root?.render(
        <Probe
          cells={[toxicTile]}
          gameState={toxicGameState}
          assetManifest={buildManifest()}
          onResolved={(result) => { latestResult = result; }}
        />
      );
    });

    const toxicHole = latestResult?.backdropLayerProps.crustMaskHoles.find((hole) => hole.key === toxicTileKey);
    expect(toxicHole).toEqual(expect.objectContaining({ key: toxicTileKey }));
  });
});
