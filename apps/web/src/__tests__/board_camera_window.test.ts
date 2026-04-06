import { describe, expect, it } from 'vitest';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import { BOARD_EDGE_PADDING_WORLD } from '../components/GameBoard';
import { createCameraEnvelope } from '../visual/camera-envelope';
import { expandRect } from '../visual/camera';
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

  it('keeps one tile of headroom above the top edge of the board', () => {
    const cells = buildCells();
    const topEdgeHex = cells.reduce((currentTop, candidate) => {
      const currentY = hexToPixel(currentTop, TILE_SIZE).y;
      const candidateY = hexToPixel(candidate, TILE_SIZE).y;
      return candidateY < currentY ? candidate : currentTop;
    });
    const rawEnvelope = createCameraEnvelope(cells, TILE_SIZE);
    const cameraEnvelope = createCameraEnvelope(cells, TILE_SIZE, BOARD_EDGE_PADDING_WORLD);
    const playerWorld = hexToPixel(topEdgeHex, TILE_SIZE);
    const windowState = resolveBoardCameraWindow({
      viewport: { width: 960, height: 640 },
      zoomMode: 'tactical',
      playerWorld,
      movementRange: 2,
      tileSize: TILE_SIZE,
      mapBounds: expandRect(rawEnvelope.bounds, BOARD_EDGE_PADDING_WORLD),
      cameraEnvelope
    });

    expect(rawEnvelope.bounds.y - windowState.viewBox.y).toBeGreaterThanOrEqual(BOARD_EDGE_PADDING_WORLD - 1e-3);
    expect(playerWorld.y).toBeGreaterThanOrEqual(windowState.viewBox.y);
  });
});
