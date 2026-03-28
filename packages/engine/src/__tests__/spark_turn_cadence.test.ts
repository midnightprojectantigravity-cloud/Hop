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
});
