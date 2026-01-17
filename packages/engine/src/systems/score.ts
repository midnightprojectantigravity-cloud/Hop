import type { GameState } from '../types';

/**
 * Canonical score computation for runs.
 * Formula: (Floor * 1000) + (HP * 100) - (Turns * 10)
 */
export const computeScore = (state: GameState): number => {
    const floor = state.floor || 0;
    const hp = state.player?.hp || 0;
    const turns = state.turnsSpent ?? state.turnNumber ?? 0;
    return (floor * 1000) + (hp * 100) - (turns * 10);
};
