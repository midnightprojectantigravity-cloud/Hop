import type { GameState, ObjectiveResult } from '../types';

/**
 * Canonical score computation for runs.
 * Formula balances progression and combat contribution:
 * (Floor * 700) + (HP * 100) + (Kills * 220) + (EnvironmentalKills * 260)
 * - (Turns * 8) - (HazardBreaches * 40) + Objective bonuses
 */
const OBJECTIVE_SUCCESS_BONUS = 250;
const FLOOR_WEIGHT = 700;
const HP_WEIGHT = 100;
const TURN_PENALTY = 8;
const KILL_WEIGHT = 220;
const ENV_KILL_WEIGHT = 260;
const HAZARD_PENALTY = 40;

export const computeScore = (state: GameState, objectiveResults?: ObjectiveResult[]): number => {
    const floor = state.floor || 0;
    const hp = state.player?.hp || 0;
    const turns = state.turnsSpent ?? state.turnNumber ?? 0;
    const kills = state.kills || 0;
    const environmentalKills = state.environmentalKills || 0;
    const hazardBreaches = state.hazardBreaches || 0;
    const objectiveBonus = (objectiveResults || [])
        .filter(result => result.success)
        .length * OBJECTIVE_SUCCESS_BONUS;

    return (floor * FLOOR_WEIGHT)
        + (hp * HP_WEIGHT)
        + (kills * KILL_WEIGHT)
        + (environmentalKills * ENV_KILL_WEIGHT)
        - (turns * TURN_PENALTY)
        - (hazardBreaches * HAZARD_PENALTY)
        + objectiveBonus;
};
