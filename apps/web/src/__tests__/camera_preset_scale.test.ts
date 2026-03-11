import { describe, expect, it } from 'vitest';
import {
  computePresetScale,
  computePresetVisibleHeightWorld,
  computePresetVisibleWidthWorld
} from '../visual/camera';

describe('camera preset scale', () => {
  it('uses the tighter viewport axis instead of width-only scaling', () => {
    const viewport = { width: 1600, height: 700 };
    const preset = 15;
    const tileSize = 36;
    const scale = computePresetScale(viewport, preset, tileSize);
    const widthScale = viewport.width / computePresetVisibleWidthWorld(preset, tileSize);
    const heightScale = viewport.height / computePresetVisibleHeightWorld(preset, tileSize);

    expect(scale).toBeCloseTo(Math.min(widthScale, heightScale), 8);
    expect(scale).toBeLessThan(widthScale);
  });
});
