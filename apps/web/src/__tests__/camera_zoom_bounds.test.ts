import { describe, expect, it } from 'vitest';
import {
  computeActionZoomBounds,
  computePresetVisibleWidthWorld,
  computeTacticalZoomBounds,
  resolveResponsiveZoomProfile
} from '../visual/camera';

describe('camera zoom bounds', () => {
  it('keeps action zoom at the gameplay floor on smaller viewports', () => {
    const viewport = { width: 680, height: 480 };
    const profile = resolveResponsiveZoomProfile({
      mode: 'action',
      viewport,
      tileSize: 24,
      movementRange: 2
    });

    expect(profile.floorPreset).toBe(7);
    expect(profile.preset).toBe(7);
  });

  it('expands action and tactical presets on larger viewports to cap tile size', () => {
    const viewport = { width: 2200, height: 1400 };
    const action = resolveResponsiveZoomProfile({
      mode: 'action',
      viewport,
      tileSize: 24,
      movementRange: 2
    });
    const tactical = resolveResponsiveZoomProfile({
      mode: 'tactical',
      viewport,
      tileSize: 24,
      movementRange: 2
    });

    expect(action.floorPreset).toBe(7);
    expect(action.preset).toBeGreaterThan(7);
    expect(tactical.floorPreset).toBe(11);
    expect(tactical.preset).toBeGreaterThan(11);
  });

  it('derives tactical sizing from the responsive preset rather than visible-tile expansion', () => {
    const viewport = { width: 860, height: 620 };
    const mapBounds = { x: 0, y: 0, width: 1400, height: 1000 };
    const profile = resolveResponsiveZoomProfile({
      mode: 'tactical',
      viewport,
      tileSize: 24,
      movementRange: 2
    });
    const bounds = computeTacticalZoomBounds({
      playerWorld: { x: 700, y: 500 },
      movementRange: 2,
      mapBounds,
      tileSize: 24,
      viewport
    });

    expect(profile.preset).toBe(11);
    expect(bounds.width).toBeCloseTo(computePresetVisibleWidthWorld(profile.preset, 24), 8);
  });

  it('does not let action zoom exceed the map bounds after responsive expansion', () => {
    const mapBounds = { x: 0, y: 0, width: 120, height: 90 };
    const bounds = computeActionZoomBounds({
      playerWorld: { x: 60, y: 45 },
      movementRange: 9,
      tileSize: 24,
      viewport: { width: 1600, height: 1000 },
      mapBounds
    });

    expect(bounds.width).toBeLessThanOrEqual(mapBounds.width);
    expect(bounds.height).toBeLessThanOrEqual(mapBounds.height);
    expect(bounds.x).toBeGreaterThanOrEqual(mapBounds.x);
    expect(bounds.y).toBeGreaterThanOrEqual(mapBounds.y);
  });
});
