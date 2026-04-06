import { describe, expect, it } from 'vitest';
import type { AiSparkAssessment } from '../types';
import { evaluateSparkDoctrine } from '../systems/ai/spark-doctrine';

const makeAssessment = (overrides: Partial<AiSparkAssessment> = {}): AiSparkAssessment => ({
    sparkBandBefore: 'stable',
    sparkBandAfterAction: 'caution',
    sparkBandIfEndedNow: 'caution',
    sparkRatioBefore: 0.7,
    sparkRatioAfterAction: 0.46,
    sparkRatioIfEndedNow: 0.5,
    actionCountBefore: 1,
    actionCountAfter: 2,
    isFirstAction: false,
    isSecondAction: true,
    isThirdActionOrLater: false,
    wouldEnterExhausted: false,
    wouldActWhileExhausted: false,
    wouldExitRested: false,
    wouldPreserveRested: false,
    wouldReenterRested: false,
    wouldDropBelowStable: true,
    wouldDropBelowCaution: false,
    fullSparkBurstWindow: false,
    isTrueRestTurn: false,
    projectedRecoveryIfEndedNow: 0.08,
    ...overrides
});

describe('spark doctrine turn cadence', () => {
    it('penalizes low-payoff second actions that drop below stable', () => {
        const lowPayoff = evaluateSparkDoctrine({
            actionType: 'MOVE',
            payoff: 'low_payoff',
            assessment: makeAssessment(),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: true
        });
        const wait = evaluateSparkDoctrine({
            actionType: 'WAIT',
            payoff: 'non_productive',
            assessment: makeAssessment({
                sparkBandAfterAction: 'stable',
                sparkBandIfEndedNow: 'stable',
                sparkRatioAfterAction: 0.7,
                sparkRatioIfEndedNow: 0.76,
                actionCountAfter: 0,
                wouldDropBelowStable: false
            }),
            restedOpportunityMode: 'setup_preserve',
            hasStandardOrBetterNonExhaustingAlternative: true
        });

        expect(lowPayoff.sparkScoreDelta).toBeLessThan(wait.sparkScoreDelta);
        expect(wait.waitForBandPreservation).toBe(true);
    });

    it('blocks move bursts from surging into exhaustion on a merely standard chase window', () => {
        const standardBurstMove = evaluateSparkDoctrine({
            actionType: 'MOVE',
            payoff: 'standard_payoff',
            assessment: makeAssessment({
                sparkBandBefore: 'rested_hold',
                sparkBandAfterAction: 'exhausted',
                sparkBandIfEndedNow: 'exhausted',
                sparkRatioBefore: 0.94,
                sparkRatioAfterAction: 0.18,
                sparkRatioIfEndedNow: 0.18,
                wouldEnterExhausted: true,
                fullSparkBurstWindow: true
            }),
            restedOpportunityMode: 'battery_only',
            hasStandardOrBetterNonExhaustingAlternative: false
        });

        expect(standardBurstMove.allowed).toBe(false);
        expect(standardBurstMove.gateReason).toBe('blocked_exhaustion_entry');
        expect(standardBurstMove.override).toBe('none');
    });

    it('rates a rested-preserving wait above a standard second move that breaks the band', () => {
        const standardMove = evaluateSparkDoctrine({
            actionType: 'MOVE',
            payoff: 'standard_payoff',
            assessment: makeAssessment({
                sparkBandBefore: 'rested_hold',
                sparkBandAfterAction: 'stable',
                sparkBandIfEndedNow: 'stable',
                sparkRatioBefore: 0.9,
                sparkRatioAfterAction: 0.58,
                sparkRatioIfEndedNow: 0.64,
                wouldExitRested: true,
                wouldDropBelowStable: false
            }),
            restedOpportunityMode: 'setup_preserve',
            hasStandardOrBetterNonExhaustingAlternative: true
        });
        const wait = evaluateSparkDoctrine({
            actionType: 'WAIT',
            payoff: 'non_productive',
            assessment: makeAssessment({
                sparkBandBefore: 'rested_hold',
                sparkBandAfterAction: 'rested_hold',
                sparkBandIfEndedNow: 'rested_hold',
                sparkRatioBefore: 0.9,
                sparkRatioAfterAction: 0.92,
                sparkRatioIfEndedNow: 0.92,
                actionCountAfter: 0,
                wouldExitRested: false,
                wouldPreserveRested: true,
                wouldDropBelowStable: false
            }),
            restedOpportunityMode: 'setup_preserve',
            hasStandardOrBetterNonExhaustingAlternative: true
        });

        expect(standardMove.sparkScoreDelta).toBeLessThan(wait.sparkScoreDelta);
        expect(wait.waitForBandPreservation).toBe(true);
    });

    it('penalizes standard progress that skips an available rested reentry', () => {
        const standardMove = evaluateSparkDoctrine({
            actionType: 'MOVE',
            payoff: 'standard_payoff',
            assessment: makeAssessment({
                sparkBandBefore: 'stable',
                sparkBandAfterAction: 'caution',
                sparkBandIfEndedNow: 'stable',
                sparkRatioBefore: 0.76,
                sparkRatioAfterAction: 0.48,
                sparkRatioIfEndedNow: 0.58,
                actionCountBefore: 0,
                actionCountAfter: 1,
                isFirstAction: true,
                isSecondAction: false,
                wouldDropBelowStable: false
            }),
            restedOpportunityMode: 'setup_preserve',
            hasStandardOrBetterNonExhaustingAlternative: true
        });
        const wait = evaluateSparkDoctrine({
            actionType: 'WAIT',
            payoff: 'non_productive',
            assessment: makeAssessment({
                sparkBandBefore: 'stable',
                sparkBandAfterAction: 'rested_hold',
                sparkBandIfEndedNow: 'rested_hold',
                sparkRatioBefore: 0.76,
                sparkRatioAfterAction: 0.84,
                sparkRatioIfEndedNow: 0.84,
                actionCountBefore: 0,
                actionCountAfter: 0,
                isFirstAction: true,
                isSecondAction: false,
                wouldReenterRested: true,
                wouldDropBelowStable: false,
                isTrueRestTurn: true
            }),
            restedOpportunityMode: 'setup_preserve',
            hasStandardOrBetterNonExhaustingAlternative: true
        });

        expect(standardMove.sparkScoreDelta).toBeLessThan(0);
        expect(wait.sparkScoreDelta).toBeGreaterThan(standardMove.sparkScoreDelta);
        expect(wait.restedDecision).toBe('true_rest');
    });
});
