import { describe, expect, it } from 'vitest';
import type { AiSparkAssessment } from '../types';
import { evaluateSparkDoctrine } from '../systems/ai/spark-doctrine';

const makeAssessment = (overrides: Partial<AiSparkAssessment> = {}): AiSparkAssessment => ({
    sparkBandBefore: 'rested_hold',
    sparkBandAfterAction: 'caution',
    sparkBandIfEndedNow: 'caution',
    sparkRatioBefore: 1,
    sparkRatioAfterAction: 0.42,
    sparkRatioIfEndedNow: 0.54,
    actionCountBefore: 0,
    actionCountAfter: 1,
    isFirstAction: true,
    isSecondAction: false,
    isThirdActionOrLater: false,
    wouldEnterExhausted: false,
    wouldActWhileExhausted: false,
    wouldExitRested: true,
    wouldPreserveRested: false,
    wouldReenterRested: false,
    wouldDropBelowStable: true,
    wouldDropBelowCaution: false,
    fullSparkBurstWindow: true,
    isTrueRestTurn: false,
    projectedRecoveryIfEndedNow: 0.12,
    ...overrides
});

describe('spark doctrine rested asset handling', () => {
    it('allows standard-payoff spending when rested is only a battery', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'USE_SKILL',
            payoff: 'standard_payoff',
            assessment: makeAssessment(),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: false
        });

        expect(result.allowed).toBe(true);
        expect(result.restedDecision).toBe('spend_battery');
        expect(result.sparkScoreDelta).toBeGreaterThan(-25);
    });

    it('rewards true rest when preserving rested and arming the next-turn bonus', () => {
        const result = evaluateSparkDoctrine({
            actionType: 'WAIT',
            payoff: 'non_productive',
            assessment: makeAssessment({
                sparkBandAfterAction: 'rested_hold',
                sparkBandIfEndedNow: 'rested_hold',
                sparkRatioAfterAction: 1,
                sparkRatioIfEndedNow: 1,
                wouldExitRested: false,
                wouldPreserveRested: true,
                wouldDropBelowStable: false,
                isTrueRestTurn: true
            }),
            restedOpportunityMode: 'setup_preserve',
            hasStandardOrBetterNonExhaustingAlternative: false
        });

        expect(result.allowed).toBe(true);
        expect(result.restedDecision).toBe('true_rest');
        expect(result.waitForBandPreservation).toBe(true);
        expect(result.sparkScoreDelta).toBeGreaterThan(20);
    });
});
