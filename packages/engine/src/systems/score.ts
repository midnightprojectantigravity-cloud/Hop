import type { GameState, ObjectiveResult } from '../types';

/**
 * Canonical score computation for runs.
 * Formula: (Floor * 1000) + (HP * 100) - (Turns * 10) + Objective bonuses
 */
const OBJECTIVE_SUCCESS_BONUS = 250;

export const computeScore = (state: GameState, objectiveResults?: ObjectiveResult[]): number => {
    const floor = state.floor || 0;
    const hp = state.player?.hp || 0;
    const turns = state.turnsSpent ?? state.turnNumber ?? 0;
    const objectiveBonus = (objectiveResults || [])
        .filter(result => result.success)
        .length * OBJECTIVE_SUCCESS_BONUS;

    return (floor * 1000) + (hp * 100) - (turns * 10) + objectiveBonus;
};
