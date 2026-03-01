import { describe, expect, it } from 'vitest';
import { runBatch, summarizeBatch } from '../systems/evaluation/balance-harness';

describe('harness ai convergence regression envelope', () => {
    it('keeps vanguard heuristic batch metrics within baseline tolerance envelope', () => {
        const seeds = Array.from({ length: 12 }, (_, i) => `ai-conv-${i}`);
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', 80, 'VANGUARD'), 'heuristic', 'VANGUARD');

        expect(summary.games).toBe(12);
        expect(summary.winRate).toBeGreaterThanOrEqual(0);
        expect(summary.winRate).toBeLessThanOrEqual(0.02);
        expect(summary.timeoutRate).toBeGreaterThanOrEqual(0);
        expect(summary.timeoutRate).toBeLessThanOrEqual(0.02);
        expect(summary.avgFloor).toBeGreaterThanOrEqual(5.75);
        expect(summary.avgFloor).toBeLessThanOrEqual(6.5);
        expect(summary.avgTurnsToLoss).toBeGreaterThanOrEqual(4.5);
        expect(summary.avgTurnsToLoss).toBeLessThanOrEqual(8.5);
        expect(summary.avgFinalPlayerHpRatio).toBeGreaterThanOrEqual(0);
        expect(summary.avgFinalPlayerHpRatio).toBeLessThanOrEqual(0.02);
    });

    it('keeps necromancer heuristic batch metrics within baseline tolerance envelope', () => {
        const seeds = Array.from({ length: 12 }, (_, i) => `ai-conv-necro-${i}`);
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', 80, 'NECROMANCER'), 'heuristic', 'NECROMANCER');

        expect(summary.games).toBe(12);
        expect(summary.winRate).toBeGreaterThanOrEqual(0);
        expect(summary.winRate).toBeLessThanOrEqual(0.02);
        expect(summary.timeoutRate).toBeGreaterThanOrEqual(0);
        expect(summary.timeoutRate).toBeLessThanOrEqual(0.1);
        expect(summary.avgFloor).toBeGreaterThanOrEqual(1.0);
        expect(summary.avgFloor).toBeLessThanOrEqual(1.75);
        expect(summary.avgTurnsToLoss).toBeGreaterThanOrEqual(12);
        expect(summary.avgTurnsToLoss).toBeLessThanOrEqual(17);
        expect(summary.avgFinalPlayerHpRatio).toBeGreaterThanOrEqual(0);
        expect(summary.avgFinalPlayerHpRatio).toBeLessThanOrEqual(0.08);
    });
});
