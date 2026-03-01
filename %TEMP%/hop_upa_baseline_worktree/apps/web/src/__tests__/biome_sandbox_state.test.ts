import { describe, expect, it } from 'vitest';
import { hydrateStoredSettings, parseStoredSettings } from '../components/biome-sandbox/state/settings-storage';
import { normalizeHexColor, readBlendMode, readMountainBlendMode } from '../components/biome-sandbox/state/settings-utils';
import type { BiomeSandboxSettings } from '../components/biome-sandbox/types';

const defaultSettings: BiomeSandboxSettings = {
  theme: 'inferno',
  seed: 'seed-default',
  injectHazards: false,
  undercurrent: {
    path: '/assets/under.webp',
    mode: 'repeat',
    scalePx: 128,
    opacity: 0.6,
    scrollX: 24,
    scrollY: 8,
    scrollDurationMs: 6000,
    offsetX: 0,
    offsetY: 0
  },
  crust: {
    path: '/assets/crust.webp',
    mode: 'repeat',
    scalePx: 128,
    opacity: 1,
    seedShiftPx: 0,
    offsetX: 0,
    offsetY: 0
  },
  clutter: {
    density: 0.1,
    maxPerHex: 3,
    bleedScaleMax: 1.5
  },
  walls: {
    mode: 'native',
    interiorDensity: 0.05,
    clusterBias: 0.1,
    keepPerimeter: true,
    mountainPath: '/assets/mountain.webp',
    mountainScale: 0.5,
    mountainOffsetX: 0,
    mountainOffsetY: 0,
    mountainAnchorX: 0.5,
    mountainAnchorY: 0.5,
    mountainCrustBlendMode: 'multiply',
    mountainCrustBlendOpacity: 1,
    mountainTintColor: '#888888',
    mountainTintBlendMode: 'overlay',
    mountainTintOpacity: 1
  },
  materials: {
    detailA: {
      path: '/assets/detail-a.webp',
      mode: 'repeat',
      scalePx: 160,
      opacity: 0.5
    },
    detailB: {
      path: '/assets/detail-b.webp',
      mode: 'repeat',
      scalePx: 192,
      opacity: 0.4
    },
    tintColor: '#8b6f4a',
    tintOpacity: 0.5,
    tintBlend: 'multiply'
  }
};

describe('biome sandbox state helpers', () => {
  it('normalizes and reads blend/color helpers deterministically', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc');
    expect(normalizeHexColor('bad-value', '#123456')).toBe('#123456');
    expect(readBlendMode('screen')).toBe('screen');
    expect(readBlendMode('unknown')).toBe('multiply');
    expect(readMountainBlendMode('off')).toBe('off');
    expect(readMountainBlendMode('overlay')).toBe('overlay');
  });

  it('hydrates stored settings with clamped values', () => {
    const stored = parseStoredSettings(JSON.stringify({
      ...defaultSettings,
      undercurrent: { ...defaultSettings.undercurrent, scalePx: 9999 },
      materials: {
        ...defaultSettings.materials,
        detailA: { ...defaultSettings.materials.detailA, scalePx: -12 },
        tintBlend: 'not-real'
      },
      walls: {
        ...defaultSettings.walls,
        mode: 'invalid',
        mountainTintColor: '#abc'
      }
    }));

    const hydrated = hydrateStoredSettings(defaultSettings, stored);
    expect(hydrated.undercurrent.scalePx).toBe(192);
    expect(hydrated.materials.detailA.scalePx).toBe(64);
    expect(hydrated.materials.tintBlend).toBe('multiply');
    expect(hydrated.walls.mode).toBe(defaultSettings.walls.mode);
    expect(hydrated.walls.mountainTintColor).toBe('#aabbcc');
  });
});

