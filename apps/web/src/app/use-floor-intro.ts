import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@hop/engine';

export type FloorIntroState = { floor: number; theme: string } | null;

export const useFloorIntro = (gameState: GameState): FloorIntroState => {
  const [floorIntro, setFloorIntro] = useState<FloorIntroState>(null);
  const lastFloorRef = useRef<number | null>(null);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    if (lastFloorRef.current === gameState.floor) return;

    setFloorIntro({ floor: gameState.floor, theme: gameState.theme || 'Inferno' });
    lastFloorRef.current = gameState.floor;
    const timer = setTimeout(() => setFloorIntro(null), 3000);
    return () => clearTimeout(timer);
  }, [gameState.floor, gameState.gameStatus, gameState.theme]);

  return floorIntro;
};
