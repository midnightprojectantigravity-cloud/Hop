import type { Point } from '@hop/engine';

export interface HoveredTileStore {
  getSnapshot: () => Point | null;
  subscribe: (listener: () => void) => () => void;
  setHoveredTile: (tile: Point | null) => void;
  clear: () => void;
}

const sameHex = (left: Point | null, right: Point | null): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.q === right.q && left.r === right.r && left.s === right.s;
};

export const createHoveredTileStore = (): HoveredTileStore => {
  let hoveredTile: Point | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => hoveredTile,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setHoveredTile: (tile) => {
      const nextTile = tile ? { ...tile } : null;
      if (sameHex(hoveredTile, nextTile)) return;
      hoveredTile = nextTile;
      notify();
    },
    clear: () => {
      if (hoveredTile === null) return;
      hoveredTile = null;
      notify();
    },
  };
};
