import { useEffect, useRef, useState } from 'react';
import type { GameState } from '@hop/engine';

export type FloorIntroState = { floor: number; theme: string } | null;

export const useFloorIntro = (gameState: GameState): FloorIntroState => {
  const [floorIntro, setFloorIntro] = useState<FloorIntroState>(null);
  const lastFloorRef = useRef<number | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIntroTimer = () => {
    if (clearTimerRef.current === null) return;
    clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  };

  useEffect(() => {
    if (gameState.gameStatus !== 'playing') {
      clearIntroTimer();
      setFloorIntro(null);
      lastFloorRef.current = null;
      return;
    }

    if (lastFloorRef.current === gameState.floor) return;

    clearIntroTimer();
    setFloorIntro({ floor: gameState.floor, theme: gameState.theme || 'Inferno' });
    lastFloorRef.current = gameState.floor;
    clearTimerRef.current = setTimeout(() => {
      setFloorIntro(null);
      clearTimerRef.current = null;
    }, 3000);
  }, [gameState.floor, gameState.gameStatus, gameState.theme]);

  useEffect(() => () => clearIntroTimer(), []);

  return floorIntro;
};
