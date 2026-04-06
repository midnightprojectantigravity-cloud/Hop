import { describe, expect, it } from 'vitest';
import type { AiSparkAssessment } from '../types';
import {
    classifyAiSparkBand,
    classifyCandidatePayoff,
    classifyRestedOpportunityMode
} from '../systems/ai/spark-doctrine';

const makeAssessment = (overrides: Partial<AiSparkAssessment> = {}): AiSparkAssessment => ({
    sparkBandBefore: 'stable',
    sparkBandAfterAction: 'stable',
    sparkBandIfEndedNow: 'stable',
    sparkRatioBefore: 0.7,
    sparkRatioAfterAction: 0.6,
    sparkRatioIfEndedNow: 0.68,
    actionCountBefore: 0,
    actionCountAfter: 1,
    isFirstAction: true,
    isSecondAction: false,
    isThirdActionOrLater: false,
    wouldEnterExhausted: false,
    wouldActWhileExhausted: false,
    wouldExitRested: false,
    wouldPreserveRested: false,
    wouldReenterRested: false,
    wouldDropBelowStable: false,
    wouldDropBelowCaution: false,
    fullSparkBurstWindow: false,
    isTrueRestTurn: false,
    projectedRecoveryIfEndedNow: 0.12,
    ...overrides
});

describe('spark doctrine classification', () => {
    it('maps rested, stable, critical, and exhausted bands from current runtime state', () => {
        expect(classifyAiSparkBand({
            spark: 100,
            maxSpark: 100,
            mana: 10,
            maxMana: 10,
            exhaustion: 0,
            actionCountThisTurn: 0,
            sparkBurnActionsThisTurn: 0,
            actedThisTurn: false,
            movedThisTurn: false,
            isExhausted: false,
            currentState: 'rested',
            pendingRestedBonus: false,
            activeRestedCritBonusPct: 0
        })).toBe('rested_hold');
        expect(classifyAiSparkBand({
            spark: 60,
            maxSpark: 100,
            mana: 10,
            maxMana: 10,
            exhaustion: 0,
            actionCountThisTurn: 0,
            sparkBurnActionsThisTurn: 0,
            actedThisTurn: false,
            movedThisTurn: false,
            isExhausted: false,
            currentState: 'base',
            pendingRestedBonus: false,
            activeRestedCritBonusPct: 0
        })).toBe('stable');
        expect(classifyAiSparkBand({
            spark: 28,
            maxSpark: 100,
            mana: 10,
            maxMana: 10,
            exhaustion: 0,
            actionCountThisTurn: 1,
            sparkBurnActionsThisTurn: 0,
            actedThisTurn: true,
            movedThisTurn: true,
            isExhausted: false,
            currentState: 'base',
            pendingRestedBonus: false,
            activeRestedCritBonusPct: 0
        })).toBe('critical');
        expect(classifyAiSparkBand({
            spark: 18,
            maxSpark: 100,
            mana: 10,
            maxMana: 10,
            exhaustion: 0,
            actionCountThisTurn: 2,
            sparkBurnActionsThisTurn: 0,
            actedThisTurn: true,
            movedThisTurn: true,
            isExhausted: true,
            currentState: 'exhausted',
            pendingRestedBonus: false,
            activeRestedCritBonusPct: 0
        })).toBe('exhausted');
    });

    it('classifies payoffs and rested opportunity mode from candidate shape', () => {
        expect(classifyCandidatePayoff({
            visibleHostileCount: 1,
            directDamage: 9,
            killCount: 0,
            objectiveDelta: 0,
            intentEstimateValue: 4,
            targetRuleScore: 0,
            canDamageNow: true,
            createsThreatNextDecision: false,
            improvesObjective: false,
            usefulReposition: false,
            hasControlIntent: false,
            hasHazardIntent: false
        })).toBe('big_payoff');

        expect(classifyRestedOpportunityMode([
            {
                actionType: 'MOVE',
                payoff: 'standard_payoff',
                assessment: makeAssessment({
                    sparkBandBefore: 'rested_hold',
                    sparkBandAfterAction: 'rested_edge',
                    sparkBandIfEndedNow: 'rested_edge',
                    wouldPreserveRested: true
                })
            }
        ])).toBe('productive_preserve');

        expect(classifyRestedOpportunityMode([
            {
                actionType: 'WAIT',
                payoff: 'non_productive',
                assessment: makeAssessment({
                    sparkBandBefore: 'rested_hold',
                    sparkBandAfterAction: 'rested_hold',
                    sparkBandIfEndedNow: 'rested_hold',
                    wouldPreserveRested: true,
                    isTrueRestTurn: true
                })
            }
        ])).toBe('setup_preserve');

        expect(classifyRestedOpportunityMode([
            {
                actionType: 'WAIT',
                payoff: 'non_productive',
                assessment: makeAssessment({
                    sparkBandBefore: 'rested_edge',
                    sparkBandAfterAction: 'rested_edge',
                    sparkBandIfEndedNow: 'rested_edge',
                    sparkRatioBefore: 0.62,
                    sparkRatioAfterAction: 0.61,
                    sparkRatioIfEndedNow: 0.61,
                    actionCountBefore: 1,
                    actionCountAfter: 0,
                    isFirstAction: false,
                    isSecondAction: true,
                    wouldPreserveRested: true,
                    wouldDropBelowStable: false,
                    isTrueRestTurn: false
                })
            }
        ])).toBe('setup_preserve');
    });
});
