import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_LOADOUTS, generateInitialState, validateReplayEnvelopeV3 } from '@hop/engine';
import type { Action, GameState } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';

type DispatchWithTrace = (action: Action, source: string) => void;

interface ReplayControllerOptions {
  dispatchWithTrace: DispatchWithTrace;
}

export interface ReplayPlaybackValidationResult {
  ok: boolean;
  actions?: Action[];
  initState?: GameState;
  error?: string;
}

export const validateReplayRecordForPlayback = (record: ReplayRecord): ReplayPlaybackValidationResult => {
  const validation = validateReplayEnvelopeV3(record.replay);
  if (!validation.valid || !validation.envelope) {
    return {
      ok: false,
      error: `Replay rejected: ${validation.errors.slice(0, 3).join(' | ')}`
    };
  }

  const run = validation.envelope.run;
  const seed = run.seed;
  const loadout = run.loadoutId ? (DEFAULT_LOADOUTS as any)[run.loadoutId] : undefined;
  const startFloor = run.startFloor ?? 1;
  const init = generateInitialState(startFloor, seed, run.initialSeed || seed, undefined, loadout);

  return {
    ok: true,
    actions: validation.envelope.actions,
    initState: init
  };
};

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
    const parsed = validateReplayRecordForPlayback(r);
    if (!parsed.ok || !parsed.actions || !parsed.initState) {
      setReplayError(parsed.error || 'Replay rejected.');
      console.error('[HOP_REPLAY] Invalid ReplayEnvelopeV3', {
        replayId: r.id,
        error: parsed.error
      });
      return;
    }

    setReplayError(null);
    setIsReplayMode(true);
    setReplayActions(parsed.actions);
    setReplayActive(false);
    replayIndexRef.current = 0;
    dispatchWithTrace({ type: 'LOAD_STATE', payload: parsed.initState } as Action, 'replay_start');
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
