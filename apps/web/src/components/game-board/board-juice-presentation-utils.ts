import { hexToPixel, TILE_SIZE, type Point } from '@hop/engine';
import type { WorldPoint } from './board-juice-presentation-types';

export const normalizeBoardDirectionToScreen = (direction: Point | undefined): { x: number; y: number } | null => {
    if (!direction || typeof direction.q !== 'number' || typeof direction.r !== 'number' || typeof direction.s !== 'number') {
        return null;
    }
    const { x, y } = hexToPixel(direction, TILE_SIZE);
    const mag = Math.hypot(x, y);
    if (!Number.isFinite(mag) || mag <= 0.0001) return null;
    return { x: x / mag, y: y / mag };
};

export const resolveJuiceAnchorHex = (anchor: any): Point | undefined => {
    const p = anchor?.hex;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') return p as Point;
    return undefined;
};

export const resolveJuiceAnchorWorld = (anchor: any): WorldPoint | undefined => {
    const p = anchor?.world;
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return p as WorldPoint;
    return undefined;
};

