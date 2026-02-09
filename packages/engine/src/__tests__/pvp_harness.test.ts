import { describe, expect, it } from 'vitest';
import { runPvpBatch, summarizePvpBatch } from '../systems/pvp-harness';

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
});

