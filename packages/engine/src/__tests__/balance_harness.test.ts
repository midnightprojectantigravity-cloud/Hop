import { describe, expect, it } from 'vitest';
import { runBatch, runHeadToHeadBatch, simulateRun, summarizeBatch, summarizeMatchup } from '../systems/evaluation/balance-harness';

describe('Balance Harness', () => {
    it('is deterministic for the same seed set', () => {
        const seeds = ['h-seed-1', 'h-seed-2', 'h-seed-3', 'h-seed-4'];
        const first = runBatch(seeds, 'heuristic', 40);
        const second = runBatch(seeds, 'heuristic', 40);
        expect(first).toEqual(second);
    });

    it('emits required difficulty metrics', () => {
        const seeds = ['r-seed-1', 'r-seed-2', 'r-seed-3'];
        const results = runBatch(seeds, 'random', 30);
        const summary = summarizeBatch(results, 'random');
        expect(summary.games).toBe(3);
        expect(typeof summary.winRate).toBe('number');
        expect(typeof summary.timeoutRate).toBe('number');
        expect(typeof summary.avgTurnsToWin).toBe('number');
        expect(typeof summary.avgTurnsToLoss).toBe('number');
        expect(typeof summary.avgFloor).toBe('number');
        expect(typeof summary.hazardDeaths).toBe('number');
        expect(typeof summary.avgPlayerSkillCastsPerRun).toBe('number');
        expect(typeof summary.actionTypeTotals).toBe('object');
        expect(typeof summary.skillUsageTotals).toBe('object');
        expect(typeof summary.avgSkillUsagePerRun).toBe('object');
        expect(typeof summary.trinityContribution).toBe('object');
        expect(typeof summary.trinityContribution.bodyContribution).toBe('number');
        expect(typeof summary.trinityContribution.mindContribution).toBe('number');
        expect(typeof summary.trinityContribution.instinctContribution).toBe('number');
    });

    it('heuristic policy improves progression versus random on fixed seeds', () => {
        const seeds = Array.from({ length: 20 }, (_, i) => `h-compare-${i + 1}`);
        const randomSummary = summarizeBatch(runBatch(seeds, 'random', 40), 'random');
        const heuristicSummary = summarizeBatch(runBatch(seeds, 'heuristic', 40), 'heuristic');
        expect(heuristicSummary.avgFloor).toBeGreaterThanOrEqual(randomSummary.avgFloor);
    });

    it('can run using a specific loadout/archetype', () => {
        const seeds = ['arch-seed-1', 'arch-seed-2'];
        const results = runBatch(seeds, 'heuristic', 25, 'HUNTER');
        expect(results.every(r => r.loadoutId === 'HUNTER')).toBe(true);
    });

    it('produces deterministic trinity contribution telemetry', () => {
        const seeds = ['trinity-seed-1', 'trinity-seed-2', 'trinity-seed-3'];
        const first = summarizeBatch(runBatch(seeds, 'heuristic', 35, 'FIREMAGE'), 'heuristic', 'FIREMAGE');
        const second = summarizeBatch(runBatch(seeds, 'heuristic', 35, 'FIREMAGE'), 'heuristic', 'FIREMAGE');
        expect(first.trinityContribution).toEqual(second.trinityContribution);
    });

    it('supports deterministic head-to-head matchup summaries', () => {
        const seeds = ['m-seed-1', 'm-seed-2', 'm-seed-3'];
        const first = runHeadToHeadBatch(
            seeds,
            { policy: 'heuristic', loadoutId: 'FIREMAGE' },
            { policy: 'heuristic', loadoutId: 'NECROMANCER' },
            30
        );
        const second = runHeadToHeadBatch(
            seeds,
            { policy: 'heuristic', loadoutId: 'FIREMAGE' },
            { policy: 'heuristic', loadoutId: 'NECROMANCER' },
            30
        );
        expect(first).toEqual(second);
        const summary = summarizeMatchup(first);
        expect(summary.games).toBe(3);
        expect(summary.leftWins + summary.rightWins + summary.ties).toBe(3);
    });

    it('does not crash hunter heuristic on previously failing seed', () => {
        expect(() => simulateRun('upa-seed-13', 'heuristic', 60, 'HUNTER')).not.toThrow();
    });

    it('uses representative starting-kit skills under heuristic policy', () => {
        const seeds = Array.from({ length: 20 }, (_, i) => `kit-usage-${i + 1}`);
        const skirmisher = summarizeBatch(runBatch(seeds, 'heuristic', 50, 'SKIRMISHER'), 'heuristic', 'SKIRMISHER');
        const firemage = summarizeBatch(runBatch(seeds, 'heuristic', 50, 'FIREMAGE'), 'heuristic', 'FIREMAGE');
        const hunter = summarizeBatch(runBatch(seeds, 'heuristic', 50, 'HUNTER'), 'heuristic', 'HUNTER');

        expect((skirmisher.skillUsageTotals.VAULT || 0)).toBeGreaterThan(0);
        expect((firemage.skillUsageTotals.ABSORB_FIRE || 0)).toBeGreaterThan(0);
        expect((hunter.skillUsageTotals.FALCON_COMMAND || 0)).toBeGreaterThan(0);
        expect((hunter.skillUsageTotals.WITHDRAWAL || 0)).toBeGreaterThan(0);
    });
});
