import {
  TILE_SIZE,
  cubeRound,
  cubeToAxial,
  createHex,
  hexToPixel,
  pointToKey,
  type Point,
} from '@hop/engine';

type WorldPoint = { x: number; y: number };
type ViewBoxRect = { x: number; y: number; width: number; height: number };

const SQRT_3 = Math.sqrt(3);
const HEX_HIT_PADDING_PX = 2;
const HEX_NEIGHBOR_OFFSETS = [
  createHex(0, 0),
  createHex(1, 0),
  createHex(1, -1),
  createHex(0, -1),
  createHex(-1, 0),
  createHex(-1, 1),
  createHex(0, 1),
];

export const worldPointToFractionalHex = (
  worldPoint: WorldPoint,
  tileSize = TILE_SIZE,
) => {
  const q = (2 * worldPoint.x) / (3 * tileSize);
  const r = worldPoint.y / (SQRT_3 * tileSize) - q / 2;
  return { q, r, s: -q - r };
};

export const isWorldPointInsideHex = (
  worldPoint: WorldPoint,
  hex: Point,
  tileSize = TILE_SIZE,
  paddingPx = HEX_HIT_PADDING_PX,
): boolean => {
  const center = hexToPixel(hex, tileSize);
  const effectiveSize = tileSize + paddingPx;
  const dx = Math.abs(worldPoint.x - center.x);
  const dy = Math.abs(worldPoint.y - center.y);

  if (dx > effectiveSize) return false;
  if (dy > (SQRT_3 * effectiveSize) / 2) return false;

  return SQRT_3 * dx + dy <= SQRT_3 * effectiveSize;
};

export const resolveBoardHexAtWorldPoint = (
  worldPoint: WorldPoint,
  boardTilesByKey: ReadonlyMap<string, Point>,
  tileSize = TILE_SIZE,
): Point | null => {
  if (boardTilesByKey.size === 0) return null;

  const rounded = cubeToAxial(cubeRound(worldPointToFractionalHex(worldPoint, tileSize)));

  for (const offset of HEX_NEIGHBOR_OFFSETS) {
    const candidate = createHex(rounded.q + offset.q, rounded.r + offset.r);
    const hex = boardTilesByKey.get(pointToKey(candidate));
    if (!hex) continue;
    if (isWorldPointInsideHex(worldPoint, hex, tileSize)) {
      return hex;
    }
  }

  return null;
};

const parseSvgViewBox = (value: string | null): ViewBoxRect | null => {
  if (!value) return null;
  const [x, y, width, height] = value
    .trim()
    .split(/[,\s]+/)
    .map(Number);

  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
};

export const clientPointToSvgWorldPoint = (
  clientPoint: WorldPoint,
  svg: Pick<SVGSVGElement, 'getAttribute' | 'getBoundingClientRect'>,
): WorldPoint | null => {
  const viewBox = parseSvgViewBox(svg.getAttribute('viewBox'));
  if (!viewBox) return null;

  const rect = svg.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  // Match preserveAspectRatio="xMidYMid meet" on the board SVG.
  const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  const offsetX = rect.left + ((rect.width - renderedWidth) / 2);
  const offsetY = rect.top + ((rect.height - renderedHeight) / 2);

  return {
    x: viewBox.x + ((clientPoint.x - offsetX) / scale),
    y: viewBox.y + ((clientPoint.y - offsetY) / scale),
  };
};
