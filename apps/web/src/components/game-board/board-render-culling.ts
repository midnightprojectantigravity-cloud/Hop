import { hexToPixel, TILE_SIZE, type Point } from '@hop/engine';
import type { CameraRect } from '../../visual/camera';

const HEX_HALF_HEIGHT = (Math.sqrt(3) * TILE_SIZE) / 2;

export const isHexPositionVisibleInViewBox = (
  position: Point,
  viewBox: CameraRect,
  paddingWorld: number = TILE_SIZE * 2.5,
): boolean => {
  const { x, y } = hexToPixel(position, TILE_SIZE);
  const minX = viewBox.x - paddingWorld;
  const maxX = viewBox.x + viewBox.width + paddingWorld;
  const minY = viewBox.y - paddingWorld;
  const maxY = viewBox.y + viewBox.height + paddingWorld;

  return x + TILE_SIZE >= minX
    && x - TILE_SIZE <= maxX
    && y + HEX_HALF_HEIGHT >= minY
    && y - HEX_HALF_HEIGHT <= maxY;
};

export const filterVisibleByHexPosition = <T>(
  items: ReadonlyArray<T>,
  getPosition: (item: T) => Point,
  viewBox: CameraRect,
  paddingWorld: number = TILE_SIZE * 2.5,
): T[] => items.filter((item) => isHexPositionVisibleInViewBox(getPosition(item), viewBox, paddingWorld));
