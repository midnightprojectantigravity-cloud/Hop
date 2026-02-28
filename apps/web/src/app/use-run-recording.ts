import { useEffect, useRef } from 'react';
import { validateReplayActions } from '@hop/engine';
import type { GameState } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';
import { buildReplayDiagnostics } from './replay-diagnostics';

const REPLAY_STORAGE_KEY = 'hop_replays_v1';
const LEADERBOARD_STORAGE_KEY = 'hop_leaderboard_v1';

export const useRunRecording = (gameState: GameState, isReplayMode: boolean): void => {
  const lastRecordedRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (isReplayMode) return;

    if ((gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') && lastRecordedRunRef.current !== gameState.initialSeed) {
      lastRecordedRunRef.current = gameState.initialSeed || 'default';
      const seed = gameState.initialSeed ?? gameState.rngSeed ?? '0';
      const score = gameState.completedRun?.score || (gameState.player.hp || 0) + (gameState.floor || 0) * 100;
      const replayValidation = validateReplayActions(gameState.actionLog || []);

      if (!replayValidation.valid) {
        console.error('[HOP_REPLAY] Refusing to persist replay with invalid action log', {
          errors: replayValidation.errors
        });
        return;
      }

      const diagnostics = buildReplayDiagnostics(replayValidation.actions, gameState.floor || 0);
      const replayRecord: ReplayRecord = {
        id: `run-${Date.now()}`,
        seed,
        loadoutId: gameState.player.archetype,
        actions: replayValidation.actions,
        score,
        floor: gameState.floor,
        date: new Date().toISOString(),
        replayVersion: 2,
        diagnostics
      };

      const rawReplays = localStorage.getItem(REPLAY_STORAGE_KEY);
      const replayList = rawReplays ? JSON.parse(rawReplays) as ReplayRecord[] : [];
      const nextReplays = [replayRecord, ...replayList].slice(0, 100);
      localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(nextReplays));

      const rawLeaderboard = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      let leaderboard = rawLeaderboard ? JSON.parse(rawLeaderboard) as any[] : [];
      leaderboard.push({
        id: replayRecord.id,
        name: 'Player',
        score: replayRecord.score,
        floor: replayRecord.floor,
        date: replayRecord.date,
        seed: replayRecord.seed,
        loadoutId: replayRecord.loadoutId,
        actions: replayRecord.actions,
        replayVersion: replayRecord.replayVersion,
        diagnostics: replayRecord.diagnostics
      });
      leaderboard.sort((a, b) => b.score - a.score);
      leaderboard = leaderboard.slice(0, 5);
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
    }

    if (gameState.gameStatus === 'hub') {
      lastRecordedRunRef.current = null;
    }
  }, [
    gameState.gameStatus,
    gameState.initialSeed,
    gameState.rngSeed,
    gameState.completedRun?.score,
    gameState.floor,
    gameState.player.hp,
    gameState.player.archetype,
    gameState.actionLog,
    isReplayMode
  ]);
};
