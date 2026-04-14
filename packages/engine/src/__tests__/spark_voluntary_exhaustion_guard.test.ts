import { describe, expect, it } from 'vitest';
import type { AiSparkAssessment } from '../types';
import { evaluateSparkDoctrine } from '../systems/ai/spark-doctrine';

const makeAssessment = (overrides: Partial<AiSparkAssessment> = {}): AiSparkAssessment => ({
    sparkBandBefore: 'stable',
    sparkBandAfterAction: 'exhausted',
    sparkBandIfEndedNow: 'critical',
    sparkRatioBefore: 0.9,
    sparkRatioAfterAction: 0.18,
    sparkRatioIfEndedNow: 0.32,
    actionCountBefore: 0,
    actionCountAfter: 1,
    isFirstAction: true,
    isSecondAction: false,
    isThirdActionOrLater: false,
    wouldEnterExhausted: true,
    wouldActWhileExhausted: false,
    wouldExitRested: false,
    wouldPreserveRested: false,
    wouldReenterRested: false,
    wouldDropBelowStable: true,
    wouldDropBelowCaution: true,
    fullSparkBurstWindow: true,
    isTrueRestTurn: false,
    projectedRecoveryIfEndedNow: 0.14,
    ...overrides
});

describe('spark doctrine exhaustion guard', () => {
    it('blocks non-lethal big-payoff crash spending into exhausted', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'USE_SKILL',
            payoff: 'big_payoff',
            decisivePayoff: false,
            assessment: makeAssessment(),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: false
        });

        expect(result.allowed).toBe(false);
        expect(result.gateReason).toBe('blocked_exhaustion_entry');
        expect(result.override).toBe('none');
        expect(result.voluntaryExhaustionAllowed).toBe(false);
    });

    it('blocks crash-spending into exhausted for low or standard payoff when an alternative exists', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'USE_SKILL',
            payoff: 'standard_payoff',
            assessment: makeAssessment(),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: true
        });

        expect(result.allowed).toBe(false);
        expect(result.gateReason).toBe('blocked_exhaustion_entry');
    });

    it('allows the first-action full-spark override only when no productive non-exhausting alternative exists', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'USE_SKILL',
            payoff: 'standard_payoff',
            assessment: makeAssessment({
                sparkBandBefore: 'rested_hold'
            }),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: false
        });

        expect(result.allowed).toBe(true);
        expect(result.override).toBe('surge_only_option');
        expect(result.voluntaryExhaustionAllowed).toBe(true);
    });

    it('allows a first-action move into exhaustion when it is the only contact window under pressure', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'MOVE',
            payoff: 'standard_payoff',
            assessment: makeAssessment({
                sparkBandBefore: 'caution',
                sparkRatioBefore: 0.48,
                fullSparkBurstWindow: false
            }),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: false,
            contactWindowOverrideEligible: true
        });

        expect(result.allowed).toBe(true);
        expect(result.override).toBe('pressure_only_option');
        expect(result.voluntaryExhaustionAllowed).toBe(true);
    });

    it('still allows decisive kill windows to override exhaustion entry', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'USE_SKILL',
            payoff: 'big_payoff',
            decisivePayoff: true,
            assessment: makeAssessment(),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: false
        });

        expect(result.allowed).toBe(true);
        expect(result.override).toBe('big_payoff');
        expect(result.voluntaryExhaustionAllowed).toBe(true);
    });
});
