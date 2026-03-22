import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import { resolveMetabolicDerivedStats } from '../systems/ires/metabolic-formulas';

describe('IRES metabolic formulas', () => {
    it('lets Body raise spark pool and recovery while modestly reducing BFI', () => {
        const lightBody = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'body-low',
            label: 'Body Low',
            body: 4,
            mind: 7,
            instinct: 6,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });
        const heavyBody = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'body-high',
            label: 'Body High',
            body: 12,
            mind: 7,
            instinct: 6,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });

        expect(heavyBody.maxSpark).toBeGreaterThan(lightBody.maxSpark);
        expect(heavyBody.sparkRecoveryPerTurn).toBeGreaterThan(lightBody.sparkRecoveryPerTurn);
        expect(heavyBody.effectiveBfi).toBeLessThan(lightBody.effectiveBfi);
    });

    it('lets Instinct lower BFI and Spark-side efficiency only', () => {
        const lowInstinct = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'instinct-low',
            label: 'Instinct Low',
            body: 7,
            mind: 7,
            instinct: 4,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });
        const highInstinct = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'instinct-high',
            label: 'Instinct High',
            body: 7,
            mind: 7,
            instinct: 16,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });

        expect(highInstinct.effectiveBfi).toBeLessThan(lowInstinct.effectiveBfi);
        expect(highInstinct.sparkEfficiencyMultiplier).toBeLessThan(lowInstinct.sparkEfficiencyMultiplier);
        expect(highInstinct.maxMana).toBe(lowInstinct.maxMana);
    });

    it('lets Mind raise mana pool and recovery while modestly reducing BFI', () => {
        const lowMind = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'mind-low',
            label: 'Mind Low',
            body: 7,
            mind: 2,
            instinct: 6,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });
        const highMind = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'mind-high',
            label: 'Mind High',
            body: 7,
            mind: 20,
            instinct: 6,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });

        expect(highMind.maxMana).toBeGreaterThan(lowMind.maxMana);
        expect(highMind.manaRecoveryPerTurn).toBeGreaterThan(lowMind.manaRecoveryPerTurn);
        expect(highMind.effectiveBfi).toBeLessThan(lowMind.effectiveBfi);
    });

    it('never raises base BFI when a single stat increases', () => {
        const baseline = {
            id: 'baseline',
            label: 'Baseline',
            body: 10,
            mind: 10,
            instinct: 10,
            weightClass: 'Standard' as const,
            burdenTier: 'Medium' as const
        };
        const current = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, baseline);

        const moreBody = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, { ...baseline, id: 'more-body', body: 11 });
        const moreInstinct = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, { ...baseline, id: 'more-instinct', instinct: 11 });
        const moreMind = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, { ...baseline, id: 'more-mind', mind: 11 });

        expect(moreBody.baseBfi).toBeLessThanOrEqual(current.baseBfi);
        expect(moreInstinct.baseBfi).toBeLessThanOrEqual(current.baseBfi);
        expect(moreMind.baseBfi).toBeLessThanOrEqual(current.baseBfi);
    });

    it('makes equal instinct gains at least as effective as equal body gains for BFI reduction', () => {
        const baseline = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'comparison-baseline',
            label: 'Comparison Baseline',
            body: 10,
            mind: 10,
            instinct: 10,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });
        const bodyGain = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'comparison-body',
            label: 'Comparison Body',
            body: 20,
            mind: 10,
            instinct: 10,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });
        const instinctGain = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'comparison-instinct',
            label: 'Comparison Instinct',
            body: 10,
            mind: 10,
            instinct: 20,
            weightClass: 'Standard',
            burdenTier: 'Medium'
        });

        const bodyReduction = baseline.baseBfi - bodyGain.baseBfi;
        const instinctReduction = baseline.baseBfi - instinctGain.baseBfi;
        expect(instinctReduction).toBeGreaterThanOrEqual(bodyReduction);
    });

    it('keeps effective BFI inside the ladder bounds at extreme values', () => {
        const ultraHeavy = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'ultra-heavy',
            label: 'Ultra Heavy',
            body: 0,
            mind: 0,
            instinct: 0,
            weightClass: 'Heavy',
            burdenTier: 'Heavy'
        });
        const superhumanLight = resolveMetabolicDerivedStats(DEFAULT_IRES_METABOLIC_CONFIG, {
            id: 'superhuman-light',
            label: 'Superhuman Light',
            body: 100,
            mind: 100,
            instinct: 100,
            weightClass: 'Light',
            burdenTier: 'Light'
        });

        expect(ultraHeavy.effectiveBfi).toBe(12);
        expect(superhumanLight.effectiveBfi).toBe(6);
    });
});
