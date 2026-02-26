import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_LOADOUTS, generateInitialState, validateReplayActions } from '@hop/engine';
import type { Action } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';

type DispatchWithTrace = (action: Action, source: string) => void;

interface ReplayControllerOptions {
  dispatchWithTrace: DispatchWithTrace;
}

export const useReplayController = ({ dispatchWithTrace }: ReplayControllerOptions) => {
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayActions, setReplayActions] = useState<Action[]>([]);
  const [replayActive, setReplayActive] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const replayIndexRef = useRef(0);

  const resetReplayUi = useCallback(() => {
    setReplayActive(false);
    setIsReplayMode(false);
    setReplayError(null);
    setReplayActions([]);
    replayIndexRef.current = 0;
  }, []);

  const startReplay = useCallback((r: ReplayRecord) => {
    if (!r) return;
    const validation = validateReplayActions(r.actions || []);
    if (!validation.valid) {
      const msg = `Replay rejected: ${validation.errors.slice(0, 3).join(' | ')}`;
      setReplayError(msg);
      console.error('[HOP_REPLAY] Invalid replay actions', {
        replayId: r.id,
        errors: validation.errors
      });
      return;
    }

    setReplayError(null);
    setIsReplayMode(true);
    setReplayActions(validation.actions);
    setReplayActive(false);
    replayIndexRef.current = 0;

    const seed = r.seed || r.id || String(Date.now());
    const loadout = r.loadoutId ? (DEFAULT_LOADOUTS as any)[r.loadoutId] : undefined;
    const init = generateInitialState(1, seed, seed, undefined, loadout);
    dispatchWithTrace({ type: 'LOAD_STATE', payload: init } as Action, 'replay_start');
  }, [dispatchWithTrace]);

  const stepReplay = useCallback(() => {
    const idx = replayIndexRef.current;
    if (idx >= replayActions.length) {
      setReplayActive(false);
      return;
    }
    dispatchWithTrace(replayActions[idx] as Action, 'replay_step');
    replayIndexRef.current = idx + 1;
  }, [dispatchWithTrace, replayActions]);

  useEffect(() => {
    if (!replayActive || !isReplayMode) return;
    const timer = window.setInterval(stepReplay, 500);
    return () => window.clearInterval(timer);
  }, [replayActive, isReplayMode, stepReplay]);

  return {
    isReplayMode,
    replayActions,
    replayActive,
    replayError,
    replayIndexRef,
    setReplayActive,
    resetReplayUi,
    startReplay,
    stepReplay
  };
};
