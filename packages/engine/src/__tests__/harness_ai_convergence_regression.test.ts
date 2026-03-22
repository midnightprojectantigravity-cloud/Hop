import { describe, expect, it } from 'vitest';
import { runBatch, summarizeBatch } from '../systems/evaluation/balance-harness';

const expectRange = (value: number, min: number, max: number, label: string) => {
    expect(value, `${label} should be >= ${min}`).toBeGreaterThanOrEqual(min);
    expect(value, `${label} should be <= ${max}`).toBeLessThanOrEqual(max);
};

describe('harness ai convergence regression envelope', () => {
    const seeds = Array.from({ length: 12 }, (_, i) => `balance-seed-${i + 1}`);

    it('keeps vanguard heuristic batch metrics within the grounded-runtime envelope', () => {
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', 80, 'VANGUARD'), 'heuristic', 'VANGUARD');

        expect(summary.games).toBe(12);
        expectRange(summary.winRate, 0, 0.02, 'vanguard winRate');
        expectRange(summary.timeoutRate, 0.15, 0.2, 'vanguard timeoutRate');
        expectRange(summary.avgFloor, 2.5, 2.8, 'vanguard avgFloor');
        expectRange(summary.avgTurnsToLoss, 7, 7.4, 'vanguard avgTurnsToLoss');
        expectRange(summary.avgFinalPlayerHpRatio, 0.1, 0.11, 'vanguard avgFinalPlayerHpRatio');
        expectRange(summary.avgRestTurns, 60, 61, 'vanguard avgRestTurns');
        expectRange(summary.pacingSignal.avgReservePressure, 0.14, 0.17, 'vanguard reserve pressure');
        expectRange(summary.pacingSignal.avgFatiguePressure, 0.55, 0.62, 'vanguard fatigue pressure');
    });

    it('keeps necromancer heuristic batch metrics within the grounded-runtime envelope', () => {
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', 80, 'NECROMANCER'), 'heuristic', 'NECROMANCER');

        expect(summary.games).toBe(12);
        expectRange(summary.winRate, 0, 0.02, 'necromancer winRate');
        expectRange(summary.timeoutRate, 0.08, 0.09, 'necromancer timeoutRate');
        expectRange(summary.avgFloor, 1, 1.05, 'necromancer avgFloor');
        expectRange(summary.avgTurnsToLoss, 10, 10.3, 'necromancer avgTurnsToLoss');
        expectRange(summary.avgFinalPlayerHpRatio, 0.08, 0.09, 'necromancer avgFinalPlayerHpRatio');
        expectRange(summary.avgRestTurns, 31, 32, 'necromancer avgRestTurns');
        expectRange(summary.pacingSignal.avgReservePressure, 0.1, 0.12, 'necromancer reserve pressure');
        expectRange(summary.pacingSignal.avgFatiguePressure, 0.35, 0.45, 'necromancer fatigue pressure');
    });

    it('keeps skirmisher heuristic batch metrics within the grounded-runtime envelope', () => {
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', 80, 'SKIRMISHER'), 'heuristic', 'SKIRMISHER');

        expect(summary.games).toBe(12);
        expectRange(summary.winRate, 0, 0.02, 'skirmisher winRate');
        expectRange(summary.timeoutRate, 0.24, 0.26, 'skirmisher timeoutRate');
        expectRange(summary.avgFloor, 1, 1.05, 'skirmisher avgFloor');
        expectRange(summary.avgTurnsToLoss, 10.5, 10.8, 'skirmisher avgTurnsToLoss');
        expectRange(summary.avgFinalPlayerHpRatio, 0.24, 0.26, 'skirmisher avgFinalPlayerHpRatio');
        expectRange(summary.avgRestTurns, 137, 138, 'skirmisher avgRestTurns');
        expectRange(summary.pacingSignal.avgReservePressure, 0.45, 0.5, 'skirmisher reserve pressure');
        expectRange(summary.pacingSignal.avgFatiguePressure, 0.35, 0.42, 'skirmisher fatigue pressure');
    });

    it('keeps firemage heuristic batch metrics within the grounded-runtime envelope', () => {
        const summary = summarizeBatch(runBatch(seeds, 'heuristic', 80, 'FIREMAGE'), 'heuristic', 'FIREMAGE');

        expect(summary.games).toBe(12);
        expectRange(summary.winRate, 0, 0.02, 'firemage winRate');
        expectRange(summary.timeoutRate, 0, 0.02, 'firemage timeoutRate');
        expectRange(summary.avgFloor, 1, 1.1, 'firemage avgFloor');
        expectRange(summary.avgTurnsToLoss, 7.7, 8, 'firemage avgTurnsToLoss');
        expectRange(summary.avgFinalPlayerHpRatio, 0, 0.01, 'firemage avgFinalPlayerHpRatio');
        expectRange(summary.avgFinalMana, 6.5, 7.1, 'firemage avgFinalMana');
        expectRange(summary.pacingSignal.avgManaRatio, 0.79, 0.83, 'firemage mana ratio');
        expectRange(summary.pacingSignal.avgReservePressure, 0.23, 0.27, 'firemage reserve pressure');
    });
});
