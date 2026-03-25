import { describe, expect, it } from 'vitest';
import { runBatch, runHeadToHeadBatch, simulateRun, summarizeBatch, summarizeMatchup } from '../systems/evaluation/balance-harness';
import { compareRuns } from '../systems/evaluation/harness-matchup';
import { runHarnessHeadToHeadBatch, runHarnessSimulationBatch } from '../systems/evaluation/harness-batch';
import * as EvaluationSurface from '../systems/evaluation';
import * as EvaluationAliasSurface from '../evaluation';

describe('Balance Harness', () => {
    it('is deterministic for the same seed set', () => {
        const seeds = ['h-seed-1'];
        const first = runBatch(seeds, 'heuristic', 8);
        const second = runBatch(seeds, 'heuristic', 8);
        expect(first).toEqual(second);
    });

    it('emits required difficulty metrics', () => {
        const seeds = ['r-seed-1'];
        const results = runBatch(seeds, 'random', 8);
        const summary = summarizeBatch(results, 'random');
        expect(typeof results[0]?.finalSpark).toBe('number');
        expect(typeof results[0]?.finalMana).toBe('number');
        expect(typeof results[0]?.finalExhaustion).toBe('number');
        expect(typeof results[0]?.peakExhaustion).toBe('number');
        expect(typeof results[0]?.avgActionsPerPlayerTurn).toBe('number');
        expect(typeof results[0]?.directorRedlineBand).toBe('number');
        expect(summary.games).toBe(1);
        expect(typeof summary.winRate).toBe('number');
        expect(typeof summary.timeoutRate).toBe('number');
        expect(typeof summary.avgTurnsToWin).toBe('number');
        expect(typeof summary.avgTurnsToLoss).toBe('number');
        expect(typeof summary.avgFloor).toBe('number');
        expect(typeof summary.hazardDeaths).toBe('number');
        expect(typeof summary.avgPlayerSkillCastsPerRun).toBe('number');
        expect(typeof summary.avgFinalSpark).toBe('number');
        expect(typeof summary.avgFinalMana).toBe('number');
        expect(typeof summary.avgFinalExhaustion).toBe('number');
        expect(typeof summary.avgPeakExhaustion).toBe('number');
        expect(typeof summary.avgRestTurns).toBe('number');
        expect(typeof summary.avgRedlineActions).toBe('number');
        expect(typeof summary.avgSparkBurnDamage).toBe('number');
        expect(typeof summary.avgActionsPerPlayerTurn).toBe('number');
        expect(typeof summary.avgDirectorRedlineBand).toBe('number');
        expect(typeof summary.avgDirectorResourceStressBand).toBe('number');
        expect(typeof summary.actionTypeTotals).toBe('object');
        expect(typeof summary.skillUsageTotals).toBe('object');
        expect(typeof summary.avgSkillUsagePerRun).toBe('object');
        expect(typeof summary.trinityContribution).toBe('object');
        expect(typeof summary.trinityContribution.bodyContribution).toBe('number');
        expect(typeof summary.trinityContribution.mindContribution).toBe('number');
        expect(typeof summary.trinityContribution.instinctContribution).toBe('number');
    });

    it('heuristic policy improves progression versus random on fixed seeds', () => {
        const seeds = Array.from({ length: 2 }, (_, i) => `h-compare-${i + 1}`);
        const randomSummary = summarizeBatch(runBatch(seeds, 'random', 8), 'random');
        const heuristicSummary = summarizeBatch(runBatch(seeds, 'heuristic', 8), 'heuristic');
        expect(heuristicSummary.avgFloor).toBeGreaterThanOrEqual(randomSummary.avgFloor);
    });

    it('can run using a specific loadout/archetype', () => {
        const seeds = ['arch-seed-1'];
        const results = runBatch(seeds, 'heuristic', 8, 'HUNTER');
        expect(results.every(r => r.loadoutId === 'HUNTER')).toBe(true);
    });

    it('produces deterministic trinity contribution telemetry', () => {
        const seeds = ['trinity-seed-1', 'trinity-seed-2'];
        const first = summarizeBatch(runBatch(seeds, 'heuristic', 8, 'FIREMAGE'), 'heuristic', 'FIREMAGE');
        const second = summarizeBatch(runBatch(seeds, 'heuristic', 8, 'FIREMAGE'), 'heuristic', 'FIREMAGE');
        expect(first.trinityContribution).toEqual(second.trinityContribution);
    });

    it('supports deterministic head-to-head matchup summaries', () => {
        const seeds = ['m-seed-1', 'm-seed-2'];
        const first = runHeadToHeadBatch(
            seeds,
            { policy: 'heuristic', loadoutId: 'FIREMAGE' },
            { policy: 'heuristic', loadoutId: 'NECROMANCER' },
            8
        );
        const second = runHeadToHeadBatch(
            seeds,
            { policy: 'heuristic', loadoutId: 'FIREMAGE' },
            { policy: 'heuristic', loadoutId: 'NECROMANCER' },
            8
        );
        expect(first).toEqual(second);
        const summary = summarizeMatchup(first);
        expect(summary.games).toBe(2);
        expect(summary.leftWins + summary.rightWins + summary.ties).toBe(2);
    });

    it('does not crash hunter heuristic on previously failing seed', () => {
        expect(() => simulateRun('upa-seed-13', 'heuristic', 8, 'HUNTER')).not.toThrow();
    });

    it('uses representative starting-kit skills under heuristic policy', () => {
        const seeds = Array.from({ length: 2 }, (_, i) => `kit-usage-${i + 1}`);
        const skirmisher = summarizeBatch(runBatch(seeds, 'heuristic', 10, 'SKIRMISHER'), 'heuristic', 'SKIRMISHER');
        const firemage = summarizeBatch(runBatch(seeds, 'heuristic', 10, 'FIREMAGE'), 'heuristic', 'FIREMAGE');

        expect((skirmisher.skillUsageTotals.VAULT || 0)).toBeGreaterThan(0);
        // Passive/no-op hazard affinity should not count as representative active Firemage usage.
        expect(
            (firemage.skillUsageTotals.FIREBALL || 0)
            + (firemage.skillUsageTotals.FIREWALK || 0)
            + (firemage.skillUsageTotals.FIREWALL || 0)
        ).toBeGreaterThan(0);
        // Hunter sequencing is covered by the crash/regression harness for now.
        // Signature Hunter behavior gets reintroduced once the post-BFI archetype pass lands.
    });

    it('normalizes empty seeds through shared harness batch primitives', () => {
        const seeds = ['', 'normalized-seed-1', '', 'normalized-seed-2', ''];
        const results = runBatch(seeds, 'heuristic', 8, 'VANGUARD');
        expect(results.map(r => r.seed)).toEqual(['normalized-seed-1', 'normalized-seed-2']);
        const summary = summarizeBatch(results, 'heuristic', 'VANGUARD');
        expect(summary.games).toBe(2);
    });

    it('keeps runBatch as a thin wrapper over shared harness batch primitives', () => {
        const seeds = ['thin-balance-1', 'thin-balance-2'];
        const wrapperRuns = runBatch(seeds, 'heuristic', 8, 'SKIRMISHER', 'sp-v1-default');
        const directRuns = runHarnessSimulationBatch(
            { seeds },
            seed => simulateRun(seed, 'heuristic', 8, 'SKIRMISHER', 'sp-v1-default')
        );
        expect(wrapperRuns).toEqual(directRuns);
    });

    it('keeps runHeadToHeadBatch as a thin wrapper over shared head-to-head batch primitives', () => {
        const seeds = ['thin-h2h-1', 'thin-h2h-2'];
        const left = { policy: 'heuristic' as const, loadoutId: 'FIREMAGE' as const };
        const right = { policy: 'heuristic' as const, loadoutId: 'NECROMANCER' as const };

        const wrapperRuns = runHeadToHeadBatch(seeds, left, right, 8, 'sp-v1-default', 'sp-v1-default');
        const directRuns = runHarnessHeadToHeadBatch(
            { seeds },
            seed => simulateRun(seed, left.policy, 8, left.loadoutId, 'sp-v1-default'),
            seed => simulateRun(seed, right.policy, 8, right.loadoutId, 'sp-v1-default'),
            (seed, leftRun, rightRun) => ({
                seed,
                left: leftRun,
                right: rightRun,
                winner: compareRuns(leftRun, rightRun)
            })
        );

        expect(wrapperRuns).toEqual(directRuns);
    });

    it('preserves stable public harness exports across evaluation surfaces', () => {
        const requiredRuntimeExports = [
            'simulateRun',
            'simulateRunDetailed',
            'runBatch',
            'runHeadToHeadBatch',
            'summarizeBatch',
            'summarizeMatchup',
            'simulatePvpRun',
            'runPvpBatch',
            'summarizePvpBatch',
            'runHarnessSimulationBatch',
            'runHarnessHeadToHeadBatch'
        ] as const;

        for (const key of requiredRuntimeExports) {
            expect(typeof EvaluationSurface[key]).toBe('function');
            expect(typeof EvaluationAliasSurface[key]).toBe('function');
            expect(EvaluationAliasSurface[key]).toBe(EvaluationSurface[key]);
        }
    });
});
