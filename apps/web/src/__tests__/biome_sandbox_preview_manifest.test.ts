import { describe, expect, it } from 'vitest';
import { buildBiomeSandboxPreviewManifest } from '../components/biome-sandbox/preview-manifest';
import { buildMountainRenderSettings } from '../components/game-board/biome-mountain-settings';
import type { BiomeSandboxSettings } from '../components/biome-sandbox/types';
import type { VisualAssetManifest } from '../visual/asset-manifest';

const REGISTERED_INFERNO_MOUNTAIN_PATH = '/assets/biomes/biome.volcano.mountain.05.webp';
const CUSTOM_INFERNO_MOUNTAIN_PATH = '/assets/biomes/biome.inferno.custom.ridge.png';

const sandboxSettings: BiomeSandboxSettings = {
  theme: 'inferno',
  seed: 'sandbox-seed',
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
    density: 0.1,
    maxPerHex: 1,
    bleedScaleMax: 1.5
  },
  walls: {
    mode: 'custom',
    interiorDensity: 0.05,
    clusterBias: 0,
    keepPerimeter: true,
    mountainPath: CUSTOM_INFERNO_MOUNTAIN_PATH,
    mountainScale: 1.21,
    mountainOffsetX: 14,
    mountainOffsetY: -18,
    mountainAnchorX: 0.31,
    mountainAnchorY: 0.86,
    mountainCrustBlendMode: 'soft-light',
    mountainCrustBlendOpacity: 0.67,
    mountainTintColor: '#123abc',
    mountainTintBlendMode: 'screen',
    mountainTintOpacity: 0.42
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
    tintOpacity: 0.2,
    tintBlend: 'multiply'
  }
};

const assetManifest = {
  version: '1',
  gridTopology: 'flat-top-hex',
  tileUnitPx: 128,
  tileAspectRatio: 1,
  layers: ['ground', 'decal', 'prop', 'unit', 'fx', 'ui'],
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
      id: 'prop.inferno.clutter.mountain.volcano.04',
      type: 'prop',
      layer: 'prop',
      theme: 'inferno',
      path: '/assets/biomes/biome.volcano.mountain.04.webp',
      width: 881,
      height: 876,
      anchor: { x: 0.5, y: 0.78 },
      tags: ['clutter', 'obstacle', 'mountain', 'blocking', 'inferno'],
      recommendedFormat: 'webp'
    },
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
      recommendedFormat: 'webp',
      mountainSettings: {
        scale: 0.53,
        anchorX: 0.5,
        anchorY: 0.55,
        offsetX: 0,
        offsetY: 0,
        crustBlendMode: 'multiply',
        crustBlendOpacity: 1,
        tintColor: '#7d7d7d',
        tintBlendMode: 'overlay',
        tintOpacity: 1
      }
    }
  ]
} as VisualAssetManifest;

describe('buildBiomeSandboxPreviewManifest', () => {
  it('injects one synthetic mountain asset for an unregistered custom inferno path', () => {
    const previewManifest = buildBiomeSandboxPreviewManifest(assetManifest, sandboxSettings, 'inferno');

    expect(previewManifest).not.toBeNull();
    const customMountainAssets = previewManifest?.assets.filter(asset => asset.path === CUSTOM_INFERNO_MOUNTAIN_PATH) || [];
    expect(customMountainAssets).toHaveLength(1);
    expect(customMountainAssets[0]).toEqual(expect.objectContaining({
      type: 'prop',
      layer: 'prop',
      path: CUSTOM_INFERNO_MOUNTAIN_PATH,
      width: 406,
      height: 457,
      theme: 'inferno',
      anchor: { x: 0.5, y: 0.78 },
      recommendedFormat: 'png',
      tags: expect.arrayContaining(['clutter', 'obstacle', 'mountain', 'blocking', 'inferno'])
    }));
    expect(customMountainAssets[0]?.mountainSettings).toBeUndefined();
    expect(customMountainAssets[0]?.mountainSettingsByTheme).toBeUndefined();
  });

  it('does not inject a duplicate synthetic mountain asset for a registered path', () => {
    const previewManifest = buildBiomeSandboxPreviewManifest(assetManifest, {
      ...sandboxSettings,
      walls: {
        ...sandboxSettings.walls,
        mountainPath: REGISTERED_INFERNO_MOUNTAIN_PATH
      }
    }, 'inferno');

    expect(previewManifest).not.toBeNull();
    expect(previewManifest?.assets).toHaveLength(assetManifest.assets.length);
    expect(previewManifest?.assets.filter(asset => asset.path === REGISTERED_INFERNO_MOUNTAIN_PATH)).toHaveLength(1);
    expect(previewManifest?.assets[1]?.id).toBe('prop.inferno.clutter.mountain.volcano.05');
  });

  it('keeps manual wall controls authoritative for a synthetic mountain swap', () => {
    const previewManifest = buildBiomeSandboxPreviewManifest(assetManifest, sandboxSettings, 'inferno');
    const syntheticAsset = previewManifest?.assets.find(asset => asset.path === CUSTOM_INFERNO_MOUNTAIN_PATH);

    const resolvedSettings = buildMountainRenderSettings({
      asset: syntheticAsset,
      biomeThemeKey: 'inferno',
      biomeThemePreset: previewManifest?.biomePresets?.inferno,
      wallsProfile: previewManifest?.walls,
      wallsThemeOverride: previewManifest?.walls?.themes?.inferno,
      crustTintBlendMode: 'multiply',
      crustTintColor: '#8b6f4a',
      defaultMountainCrustBlendOpacity: 0.4
    });

    expect(resolvedSettings).toEqual(expect.objectContaining({
      scale: sandboxSettings.walls.mountainScale,
      offsetX: sandboxSettings.walls.mountainOffsetX,
      offsetY: sandboxSettings.walls.mountainOffsetY,
      anchorX: sandboxSettings.walls.mountainAnchorX,
      anchorY: sandboxSettings.walls.mountainAnchorY,
      crustBlendMode: sandboxSettings.walls.mountainCrustBlendMode,
      crustBlendOpacity: sandboxSettings.walls.mountainCrustBlendOpacity,
      tintColor: sandboxSettings.walls.mountainTintColor,
      tintBlendMode: sandboxSettings.walls.mountainTintBlendMode,
      tintOpacity: sandboxSettings.walls.mountainTintOpacity
    }));
  });
});
