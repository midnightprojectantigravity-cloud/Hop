import { describe, expect, it } from 'vitest';
import type { IresRuntimeState } from '../types';
import { getAiResourceSignals } from '../systems/ai/resource-signals';

const makeIres = (overrides: Partial<IresRuntimeState> = {}): IresRuntimeState => ({
    spark: 100,
    maxSpark: 100,
    mana: 40,
    maxMana: 40,
    exhaustion: 0,
    actionCountThisTurn: 0,
    sparkBurnActionsThisTurn: 0,
    actedThisTurn: false,
    movedThisTurn: false,
    isExhausted: false,
    currentState: 'rested',
    pendingRestedBonus: false,
    activeRestedCritBonusPct: 0,
    ...overrides
});

describe('ai resource signals', () => {
    it('returns a neutral signal profile when no IRES state is present', () => {
        const signals = getAiResourceSignals(undefined);

        expect(signals.sparkRatio).toBe(1);
        expect(signals.manaRatio).toBe(1);
        expect(signals.exhaustionRatio).toBe(0);
        expect(signals.reservePressure).toBe(0);
        expect(signals.fatiguePressure).toBe(0);
        expect(signals.recoveryPressure).toBe(0);
        expect(signals.actionChainPressure).toBe(0);
    });

    it('derives normalized reserve and recovery pressure from current pools', () => {
        const signals = getAiResourceSignals(makeIres({
            spark: 25,
            mana: 10,
            exhaustion: 50,
            actionCountThisTurn: 2
        }));

        expect(signals.sparkRatio).toBeCloseTo(0.25, 5);
        expect(signals.manaRatio).toBeCloseTo(0.25, 5);
        expect(signals.exhaustionRatio).toBeCloseTo(0.5, 5);
        expect(signals.reservePressure).toBeCloseTo(0.75, 5);
        expect(signals.fatiguePressure).toBeCloseTo(0.4, 5);
        expect(signals.actionChainPressure).toBeCloseTo(0.5, 5);
        expect(signals.recoveryPressure).toBeCloseTo(0.5375, 5);
    });

    it('pins fatigue pressure to full when the actor is exhausted', () => {
        const signals = getAiResourceSignals(makeIres({
            spark: 80,
            mana: 35,
            exhaustion: 20,
            isExhausted: true,
            currentState: 'exhausted',
            pendingRestedBonus: true
        }));

        expect(signals.sparkRatio).toBeCloseTo(0.8, 5);
        expect(signals.manaRatio).toBeCloseTo(0.875, 5);
        expect(signals.reservePressure).toBeCloseTo(0.2, 5);
        expect(signals.fatiguePressure).toBe(1);
        expect(signals.recoveryPressure).toBeCloseTo(0.57, 5);
    });
});
