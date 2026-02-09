import type { GameState, ObjectiveResult, RunObjective } from '../types';
import { randomFromSeed } from './rng';
import { computeScore } from './score';

export const toDateKey = (date?: string | Date): string => {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    const d = date instanceof Date ? date : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const createDailySeed = (dateKey: string): string => `daily:${dateKey}`;

export const createDailyObjectives = (seed: string): RunObjective[] => {
    const turnLimit = 18 + Math.floor(randomFromSeed(seed, 0) * 8);
    return [
        { id: 'TURN_LIMIT', label: `Finish within ${turnLimit} turns`, target: turnLimit },
        { id: 'HAZARD_CONSTRAINT', label: 'Take no hazard damage', target: 0 }
    ];
};

export const evaluateObjectives = (state: GameState): ObjectiveResult[] => {
    const objectives = state.runObjectives || [];
    return objectives.map(obj => {
        if (obj.id === 'TURN_LIMIT') {
            const value = state.turnsSpent || 0;
            return { ...obj, value, success: value <= obj.target };
        }
        const value = state.hazardBreaches || 0;
        return { ...obj, value, success: value <= obj.target };
    });
};

export const buildRunSummary = (state: GameState) => {
    const seed = state.initialSeed ?? state.rngSeed ?? '0';
    const objectives = evaluateObjectives(state);
    const combatEvents = state.combatScoreEvents || [];
    const avgEfficiency = combatEvents.length
        ? Number((combatEvents.reduce((acc, e) => acc + e.efficiency, 0) / combatEvents.length).toFixed(4))
        : 0;
    const riskBonusEvents = combatEvents.filter(e => e.riskBonusApplied).length;
    return {
        seed,
        actionLog: state.actionLog,
        score: computeScore(state, objectives),
        floor: state.floor,
        objectives,
        combatTelemetry: {
            events: combatEvents.length,
            avgEfficiency,
            riskBonusEvents
        }
    };
};
