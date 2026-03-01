import { useEffect } from 'react';
import { pointToKey } from '@hop/engine';
import type { GameState, Point } from '@hop/engine';

export const useDebugQueryBridge = (gameState: GameState, enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;
    (window as any).state = gameState;
    (window as any).QUERY = {
      tile: (q: number, r: number) => {
        const p: Point = { q, r, s: -q - r };
        const key = pointToKey(p);
        console.log(`Checking Map for Key: "${key}"`);
        return gameState.tiles.get(key);
      },
      whereAmI: () => {
        const p = gameState.player.position;
        const key = pointToKey(p);
        const tile = gameState.tiles.get(key);
        return {
          coords: p,
          key,
          tileExists: !!tile,
          tileData: tile
        };
      },
      dumpKeys: () => Array.from(gameState.tiles.keys())
    };
  }, [gameState, enabled]);
};
