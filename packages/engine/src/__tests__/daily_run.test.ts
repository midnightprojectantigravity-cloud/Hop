import { describe, expect, it } from 'vitest';
import { gameReducer, generateHubState } from '../logic';
import { buildRunSummary, createDailyObjectives, createDailySeed, toDateKey } from '../systems/run-objectives';

describe('Daily Run Loop', () => {
    it('uses deterministic daily seed/objectives for the same date', () => {
        const hub = generateHubState();
        const date = '2026-02-08';

        const runA = gameReducer(hub, { type: 'START_RUN', payload: { loadoutId: 'VANGUARD', mode: 'daily', date } });
        const runB = gameReducer(hub, { type: 'START_RUN', payload: { loadoutId: 'VANGUARD', mode: 'daily', date } });

        expect(runA.initialSeed).toBe(runB.initialSeed);
        expect(runA.runObjectives).toEqual(runB.runObjectives);
        expect(runA.dailyRunDate).toBe(date);
    });

    it('builds end-run summary with seed, score, and objective outcomes', () => {
        const hub = generateHubState();
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'VANGUARD', mode: 'daily', date: '2026-02-08' }
        });

        const progressed = {
            ...run,
            turnsSpent: 5,
            floor: 3,
            hazardBreaches: 1
        };
        const summary = buildRunSummary(progressed);

        expect(summary.seed).toBe(progressed.initialSeed);
        expect(typeof summary.score).toBe('number');
        expect(summary.objectives?.length).toBeGreaterThan(0);
        const hazard = summary.objectives?.find(o => o.id === 'HAZARD_CONSTRAINT');
        expect(hazard?.success).toBe(false);
    });

    it('adds objective bonus to score for successful objectives', () => {
        const hub = generateHubState();
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'VANGUARD', mode: 'daily', date: '2026-02-08' }
        });

        const successState = {
            ...run,
            turnsSpent: 1,
            floor: 2,
            hazardBreaches: 0
        };
        const failedState = {
            ...run,
            turnsSpent: 99,
            floor: 2,
            hazardBreaches: 3
        };

        const successSummary = buildRunSummary(successState);
        const failedSummary = buildRunSummary(failedState);

        expect(successSummary.score).toBeGreaterThan(failedSummary.score);
    });

    it('daily objective generation is stable by seed', () => {
        const dateKey = toDateKey('2026-02-08');
        const seed = createDailySeed(dateKey);
        expect(createDailyObjectives(seed)).toEqual(createDailyObjectives(seed));
    });
});
