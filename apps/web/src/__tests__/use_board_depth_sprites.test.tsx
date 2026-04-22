// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pointToKey, type Point } from '@hop/engine';
import { buildBiomeSandboxPreviewManifest } from '../components/biome-sandbox/preview-manifest';
import type { BiomeSandboxSettings } from '../components/biome-sandbox/types';
import { useBoardDepthSprites } from '../components/game-board/useBoardDepthSprites';
import type { VisualAssetManifest } from '../visual/asset-manifest';

const WALL_HEX: Point = { q: 2, r: 4, s: -6 };
const OBSIDIAN_PATH = '/assets/biomes/biome.black.obsidian.01.webp';
const REGISTERED_INFERNO_MOUNTAIN_PATH = '/assets/biomes/biome.volcano.mountain.05.webp';
const CUSTOM_INFERNO_MOUNTAIN_PATH = '/assets/biomes/biome.inferno.custom.ridge.png';

const wallKey = pointToKey(WALL_HEX);
const wallFlags = new Map([
  [wallKey, { isWall: true, isLava: false, isToxic: false, isFire: false, isVoid: false }]
]);

const crossThemeAssetManifest = {
  assets: [
    {
      id: 'prop.inferno.clutter.obsidian.01',
      type: 'prop',
      layer: 'prop',
      theme: 'inferno',
      path: OBSIDIAN_PATH,
      width: 406,
      height: 457,
      anchor: { x: 0.5, y: 0.78 },
      tags: ['clutter', 'obstacle', 'mountain', 'blocking', 'inferno']
    }
  ]
} as VisualAssetManifest;

const previewSourceAssetManifest = {
  biomeLayers: {},
  biomeMaterials: {},
  walls: {
    mountainPath: REGISTERED_INFERNO_MOUNTAIN_PATH,
    themes: {
      inferno: {
        mountainPath: REGISTERED_INFERNO_MOUNTAIN_PATH
      }
    }
  },
  biomePresets: {
    inferno: {
      walls: {
        mountainPath: REGISTERED_INFERNO_MOUNTAIN_PATH
      }
    }
  },
  assets: [
    {
      id: 'prop.inferno.clutter.mountain.volcano.05',
      type: 'prop',
      layer: 'prop',
      theme: 'inferno',
      path: REGISTERED_INFERNO_MOUNTAIN_PATH,
      width: 406,
      height: 457,
      anchor: { x: 0.5, y: 0.78 },
      tags: ['clutter', 'obstacle', 'mountain', 'blocking', 'inferno'],
      recommendedFormat: 'webp'
    }
  ]
} as VisualAssetManifest;

const previewSettings: BiomeSandboxSettings = {
  theme: 'inferno',
  seed: 'depth-sprite-preview-seed',
  injectHazards: true,
  undercurrent: {
    path: '/assets/biomes/biome.lava.01.webp',
    mode: 'repeat',
    scalePx: 160,
    opacity: 0.62,
    scrollX: 120,
    scrollY: 90,
    scrollDurationMs: 92000,
    offsetX: 0,
    offsetY: 0
  },
  crust: {
    path: '/assets/biomes/biome.black.floor.02.webp',
    mode: 'repeat',
    scalePx: 192,
    opacity: 1,
    seedShiftPx: 96,
    offsetX: 0,
    offsetY: 0
  },
  clutter: {
    density: 0,
    maxPerHex: 1,
    bleedScaleMax: 1.5
  },
  walls: {
    mode: 'custom',
    interiorDensity: 0.05,
    clusterBias: 0,
    keepPerimeter: true,
    mountainPath: CUSTOM_INFERNO_MOUNTAIN_PATH,
    mountainScale: 1,
    mountainOffsetX: 0,
    mountainOffsetY: 0,
    mountainAnchorX: 0.5,
    mountainAnchorY: 0.78,
    mountainCrustBlendMode: 'multiply',
    mountainCrustBlendOpacity: 1,
    mountainTintColor: '#7d7d7d',
    mountainTintBlendMode: 'overlay',
    mountainTintOpacity: 1
  },
  materials: {
    detailA: {
      path: '',
      mode: 'off',
      scalePx: 160,
      opacity: 0
    },
    detailB: {
      path: '',
      mode: 'off',
      scalePx: 192,
      opacity: 0
    },
    tintColor: '#8b6f4a',
    tintOpacity: 0,
    tintBlend: 'multiply'
  }
};

const DepthSpritesProbe: React.FC<{
  assetManifest: VisualAssetManifest;
  biomeThemeKey: string;
  wallsThemeMountainPath?: string;
  onResolved: (result: ReturnType<typeof useBoardDepthSprites>) => void;
}> = ({ assetManifest, biomeThemeKey, wallsThemeMountainPath, onResolved }) => {
  const result = useBoardDepthSprites({
    assetManifest,
    biomeThemeKey,
    biomeSeed: 'void-depth-sprite-seed',
    mountainAssetPathOverride: undefined,
    wallsMountainPath: undefined,
    wallsThemeMountainPath,
    clutterLayer: undefined,
    cells: [WALL_HEX],
    tileVisualFlags: wallFlags,
    boardProps: [],
    resolveMountainSettings: () => ({
      scale: 1,
      offsetY: 0
    })
  });

  React.useEffect(() => {
    onResolved(result);
  }, [onResolved, result]);

  return null;
};

describe('useBoardDepthSprites', () => {
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

  it('emits a mountain sprite for an explicit wall path even when the asset theme differs', async () => {
    let latestResult: ReturnType<typeof useBoardDepthSprites> | null = null;

    await act(async () => {
      root?.render(
        <DepthSpritesProbe
          assetManifest={crossThemeAssetManifest}
          biomeThemeKey="void"
          wallsThemeMountainPath={OBSIDIAN_PATH}
          onResolved={(result) => { latestResult = result; }}
        />
      );
    });

    expect(latestResult?.depthSortedSprites).toHaveLength(1);
    expect(latestResult?.depthSortedSprites[0]).toEqual(expect.objectContaining({
      kind: 'mountain',
      position: WALL_HEX,
      asset: expect.objectContaining({
        id: 'prop.inferno.clutter.obsidian.01',
        theme: 'inferno',
        path: OBSIDIAN_PATH
      })
    }));
    expect(latestResult?.mountainCoveredWallKeys.has(wallKey)).toBe(true);
  });

  it('emits a mountain sprite for an unregistered custom inferno path injected by the preview manifest', async () => {
    const previewManifest = buildBiomeSandboxPreviewManifest(
      previewSourceAssetManifest,
      previewSettings,
      'inferno'
    );
    let latestResult: ReturnType<typeof useBoardDepthSprites> | null = null;

    expect(previewManifest).not.toBeNull();

    await act(async () => {
      root?.render(
        <DepthSpritesProbe
          assetManifest={previewManifest as VisualAssetManifest}
          biomeThemeKey="inferno"
          wallsThemeMountainPath={CUSTOM_INFERNO_MOUNTAIN_PATH}
          onResolved={(result) => { latestResult = result; }}
        />
      );
    });

    expect(latestResult?.depthSortedSprites).toHaveLength(1);
    expect(latestResult?.depthSortedSprites[0]).toEqual(expect.objectContaining({
      kind: 'mountain',
      position: WALL_HEX,
      asset: expect.objectContaining({
        path: CUSTOM_INFERNO_MOUNTAIN_PATH,
        width: 406,
        height: 457,
        theme: 'inferno'
      })
    }));
    expect(latestResult?.mountainCoveredWallKeys.has(wallKey)).toBe(true);
  });
});
