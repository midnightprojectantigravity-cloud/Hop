import { describe, expect, it } from 'vitest';
import { runPvpBatch, summarizePvpBatch } from '../systems/evaluation/pvp-harness';
import { runHarnessSimulationBatch } from '../systems/evaluation/harness-batch';
import { simulatePvpRun } from '../systems/evaluation/pvp-harness';

describe('PVP Harness', () => {
    it('is deterministic for fixed seeds and policies', () => {
        const seeds = ['pvp-seed-1', 'pvp-seed-2', 'pvp-seed-3'];
        const first = runPvpBatch(seeds, 'VANGUARD', 'HUNTER', 'heuristic', 'heuristic', 20);
        const second = runPvpBatch(seeds, 'VANGUARD', 'HUNTER', 'heuristic', 'heuristic', 20);
        expect(first).toEqual(second);
    });

    it('produces internally consistent summaries', () => {
        const seeds = ['pvp-seed-a', 'pvp-seed-b', 'pvp-seed-c', 'pvp-seed-d'];
        const runs = runPvpBatch(seeds, 'FIREMAGE', 'NECROMANCER', 'heuristic', 'random', 20);
        const summary = summarizePvpBatch(runs);
        expect(summary.games).toBe(4);
        expect(summary.leftWins + summary.rightWins + summary.draws).toBe(4);
        expect(typeof summary.leftActionTotals).toBe('object');
        expect(typeof summary.rightActionTotals).toBe('object');
        expect(typeof summary.leftSkillUsageTotals).toBe('object');
        expect(typeof summary.rightSkillUsageTotals).toBe('object');
    });

    it('normalizes empty seeds through shared harness batch primitives', () => {
        const seeds = ['', 'pvp-normalized-a', '', 'pvp-normalized-b', ''];
        const runs = runPvpBatch(seeds, 'VANGUARD', 'HUNTER', 'heuristic', 'heuristic', 20);
        expect(runs.map(run => run.seed)).toEqual(['pvp-normalized-a', 'pvp-normalized-b']);
        const summary = summarizePvpBatch(runs);
        expect(summary.games).toBe(2);
    });

    it('keeps runPvpBatch as a thin wrapper over shared harness batch primitives', () => {
        const seeds = ['pvp-thin-1', 'pvp-thin-2'];
        const wrapperRuns = runPvpBatch(seeds, 'FIREMAGE', 'ASSASSIN', 'heuristic', 'random', 18);
        const directRuns = runHarnessSimulationBatch(
            { seeds },
            seed => simulatePvpRun(seed, 'FIREMAGE', 'ASSASSIN', 'heuristic', 'random', 18)
        );
        expect(wrapperRuns).toEqual(directRuns);
    });
});
