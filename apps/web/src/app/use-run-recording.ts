import { useEffect, useRef } from 'react';
import { fingerprintFromState, validateReplayEnvelopeV3 } from '@hop/engine';
import type { GameState, ReplayEnvelopeV3 } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';
import { buildReplayDiagnostics } from './replay-diagnostics';

export const REPLAY_STORAGE_KEY = 'hop_replays_v3';
export const LEADERBOARD_STORAGE_KEY = 'hop_leaderboard_v3';

export const buildReplayRecordFromGameState = (gameState: GameState): ReplayRecord | null => {
  const seed = gameState.initialSeed ?? gameState.rngSeed ?? '0';
  const score = gameState.completedRun?.score || (gameState.player.hp || 0) + (gameState.floor || 0) * 100;
  const diagnostics = buildReplayDiagnostics(gameState.actionLog || [], gameState.floor || 0);
  const envelope: ReplayEnvelopeV3 = {
    version: 3,
    run: {
      seed,
      initialSeed: gameState.initialSeed ?? seed,
      loadoutId: gameState.player.archetype,
      startFloor: 1,
      mapSize: {
        width: gameState.gridWidth,
        height: gameState.gridHeight
      },
      mapShape: gameState.mapShape || 'diamond',
      mode: gameState.dailyRunDate ? 'daily' : 'normal',
      date: gameState.dailyRunDate
    },
    actions: gameState.actionLog || [],
    meta: {
      recordedAt: new Date().toISOString(),
      source: 'client',
      diagnostics,
      final: {
        score,
        floor: gameState.floor,
        fingerprint: fingerprintFromState(gameState),
        gameStatus: gameState.gameStatus === 'won' ? 'won' : 'lost'
      }
    }
  };

  const replayValidation = validateReplayEnvelopeV3(envelope);
  if (!replayValidation.valid || !replayValidation.envelope) {
    console.error('[HOP_REPLAY] Refusing to persist replay with invalid action log', {
      errors: replayValidation.errors
    });
    return null;
  }

  return {
    id: `run-${Date.now()}`,
    replay: replayValidation.envelope,
    score,
    floor: gameState.floor,
    date: replayValidation.envelope.meta.recordedAt,
    diagnostics
  };
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const persistReplayRecord = (
  replayRecord: ReplayRecord,
  storage: StorageLike = localStorage
): void => {
  const rawReplays = storage.getItem(REPLAY_STORAGE_KEY);
  const replayList = rawReplays ? JSON.parse(rawReplays) as ReplayRecord[] : [];
  const nextReplays = [replayRecord, ...replayList].slice(0, 100);
  storage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(nextReplays));

  const rawLeaderboard = storage.getItem(LEADERBOARD_STORAGE_KEY);
  let leaderboard = rawLeaderboard ? JSON.parse(rawLeaderboard) as any[] : [];
  leaderboard.push({
    id: replayRecord.id,
    name: 'Player',
    score: replayRecord.score,
    floor: replayRecord.floor,
    date: replayRecord.date,
    replay: replayRecord.replay,
    diagnostics: replayRecord.diagnostics
  });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 5);
  storage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
};

export const useRunRecording = (gameState: GameState, isReplayMode: boolean): void => {
  const lastRecordedRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (isReplayMode) return;

    const runIdentity = [
      gameState.initialSeed || gameState.rngSeed || 'default',
      gameState.mapShape || 'diamond',
      `${gameState.gridWidth}x${gameState.gridHeight}`
    ].join('|');

    if ((gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') && lastRecordedRunRef.current !== runIdentity) {
      lastRecordedRunRef.current = runIdentity;
      const replayRecord = buildReplayRecordFromGameState(gameState);
      if (!replayRecord) return;
      persistReplayRecord(replayRecord);
    }

    if (gameState.gameStatus === 'hub') {
      lastRecordedRunRef.current = null;
    }
  }, [
    gameState.gameStatus,
    gameState.initialSeed,
    gameState.rngSeed,
    gameState.mapShape,
    gameState.gridWidth,
    gameState.gridHeight,
    gameState.completedRun?.score,
    gameState.floor,
    gameState.player.hp,
    gameState.player.archetype,
    gameState.actionLog,
    isReplayMode
  ]);
};
