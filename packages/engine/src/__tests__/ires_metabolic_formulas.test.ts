import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import { resolveMetabolicDerivedStats } from '../systems/ires/metabolic-formulas';

describe('IRES metabolic formulas', () => {
    it('lets Body raise spark pool and recovery without changing BFI', () => {
        const lightBody = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'body-low',
            label: 'Body Low',
            body: 4,
            mind: 7,
            instinct: 6,
            weightClass: 'Standard'
        });
        const heavyBody = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'body-high',
            label: 'Body High',
            body: 12,
            mind: 7,
            instinct: 6,
            weightClass: 'Standard'
        });

        expect(heavyBody.maxSpark).toBeGreaterThan(lightBody.maxSpark);
        expect(heavyBody.sparkRecoveryPerTurn).toBeGreaterThan(lightBody.sparkRecoveryPerTurn);
        expect(heavyBody.effectiveBfi).toBe(lightBody.effectiveBfi);
    });

    it('lets Instinct lower BFI and Spark-side efficiency only', () => {
        const lowInstinct = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'instinct-low',
            label: 'Instinct Low',
            body: 7,
            mind: 7,
            instinct: 4,
            weightClass: 'Standard'
        });
        const highInstinct = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'instinct-high',
            label: 'Instinct High',
            body: 7,
            mind: 7,
            instinct: 16,
            weightClass: 'Standard'
        });

        expect(highInstinct.effectiveBfi).toBeLessThan(lowInstinct.effectiveBfi);
        expect(highInstinct.sparkEfficiencyMultiplier).toBeLessThan(lowInstinct.sparkEfficiencyMultiplier);
        expect(highInstinct.maxMana).toBe(lowInstinct.maxMana);
    });

    it('lets Mind raise mana pool and recovery without changing BFI', () => {
        const lowMind = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'mind-low',
            label: 'Mind Low',
            body: 7,
            mind: 4,
            instinct: 6,
            weightClass: 'Standard'
        });
        const highMind = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'mind-high',
            label: 'Mind High',
            body: 7,
            mind: 12,
            instinct: 6,
            weightClass: 'Standard'
        });

        expect(highMind.maxMana).toBeGreaterThan(lowMind.maxMana);
        expect(highMind.manaRecoveryPerTurn).toBeGreaterThan(lowMind.manaRecoveryPerTurn);
        expect(highMind.effectiveBfi).toBe(lowMind.effectiveBfi);
    });
});
