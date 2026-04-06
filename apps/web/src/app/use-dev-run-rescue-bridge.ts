import { useEffect } from 'react';
import type { Action, GameState } from '@hop/engine';
import { reviveFloor10ButcherState } from './dev-floor10-butcher-rescue';

declare global {
  interface Window {
    __HOP_DEV__?: {
      reviveFloor10Butcher?: () => boolean;
    };
  }
}

export const useDevRunRescueBridge = ({
  gameState,
  dispatchWithTrace
}: {
  gameState: GameState;
  dispatchWithTrace: (action: Action, source: string) => void;
}) => {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;

    const bridge = (window.__HOP_DEV__ ||= {});
    const reviveFloor10Butcher = () => {
      const revived = reviveFloor10ButcherState(gameState);
      if (!revived) return false;
      dispatchWithTrace({ type: 'LOAD_STATE', payload: revived }, 'dev_revive_floor10_butcher');
      return true;
    };

    bridge.reviveFloor10Butcher = reviveFloor10Butcher;

    return () => {
      if (bridge.reviveFloor10Butcher === reviveFloor10Butcher) {
        delete bridge.reviveFloor10Butcher;
      }
    };
  }, [dispatchWithTrace, gameState]);
};
