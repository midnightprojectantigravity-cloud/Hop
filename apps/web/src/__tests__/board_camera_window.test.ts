import { describe, expect, it } from 'vitest';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import { createCameraEnvelope } from '../visual/camera-envelope';
import { resolveBoardCameraWindow } from '../components/game-board/useBoardPresentationController';

const hex = (q: number, r: number, s = -q - r) => ({ q, r, s });

const buildCells = () => {
  const cells: Array<{ q: number; r: number; s: number }> = [];
  for (let q = -2; q <= 2; q += 1) {
    for (let r = -2; r <= 2; r += 1) {
      cells.push(hex(q, r));
    }
  }
  return cells;
};

describe('board camera window', () => {
  it('keeps a mid-map player centered within five percent', () => {
    const cells = buildCells();
    const cameraEnvelope = createCameraEnvelope(cells, TILE_SIZE);
    const playerWorld = hexToPixel(hex(0, 0), TILE_SIZE);
    const windowState = resolveBoardCameraWindow({
      viewport: { width: 960, height: 640 },
      zoomMode: 'tactical',
      playerWorld,
      movementRange: 2,
      tileSize: TILE_SIZE,
      mapBounds: cameraEnvelope.bounds,
      cameraEnvelope
    });
    const relativeX = (playerWorld.x - windowState.viewBox.x) / windowState.viewBox.width;
    const relativeY = (playerWorld.y - windowState.viewBox.y) / windowState.viewBox.height;

    expect(relativeX).toBeGreaterThan(0.45);
    expect(relativeX).toBeLessThan(0.55);
    expect(relativeY).toBeGreaterThan(0.45);
    expect(relativeY).toBeLessThan(0.55);
  });

  it('keeps an edge player visible without forcing exact centering', () => {
    const cells = buildCells();
    const cameraEnvelope = createCameraEnvelope(cells, TILE_SIZE);
    const playerWorld = hexToPixel(hex(-2, 0), TILE_SIZE);
    const windowState = resolveBoardCameraWindow({
      viewport: { width: 960, height: 640 },
      zoomMode: 'tactical',
      playerWorld,
      movementRange: 2,
      tileSize: TILE_SIZE,
      mapBounds: cameraEnvelope.bounds,
      cameraEnvelope
    });
    const relativeX = (playerWorld.x - windowState.viewBox.x) / windowState.viewBox.width;
    const relativeY = (playerWorld.y - windowState.viewBox.y) / windowState.viewBox.height;

    expect(relativeX).toBeGreaterThanOrEqual(0);
    expect(relativeX).toBeLessThanOrEqual(1);
    expect(relativeY).toBeGreaterThanOrEqual(0);
    expect(relativeY).toBeLessThanOrEqual(1);
    expect(Math.abs(relativeX - 0.5)).toBeGreaterThan(0.06);
  });

  it('keeps the player centered even when desktop safe insets are present', () => {
    const cells = buildCells();
    const cameraEnvelope = createCameraEnvelope(cells, TILE_SIZE);
    const playerWorld = hexToPixel(hex(0, 0), TILE_SIZE);
    const windowState = resolveBoardCameraWindow({
      viewport: {
        width: 1200,
        height: 760,
        insets: {
          top: 96,
          right: 220,
          bottom: 0,
          left: 0
        }
      },
      zoomMode: 'action',
      playerWorld,
      movementRange: 2,
      tileSize: TILE_SIZE,
      mapBounds: cameraEnvelope.bounds,
      cameraEnvelope
    });
    const relativeX = (playerWorld.x - windowState.viewBox.x) / windowState.viewBox.width;
    const relativeY = (playerWorld.y - windowState.viewBox.y) / windowState.viewBox.height;

    expect(relativeX).toBeGreaterThan(0.45);
    expect(relativeX).toBeLessThan(0.55);
    expect(relativeY).toBeGreaterThan(0.45);
    expect(relativeY).toBeLessThan(0.55);
  });
});
