import type {
    AiCandidatePayoff,
    AiRestedOpportunityMode,
    AiSparkAssessment,
    AiSparkBand,
    AiSparkDoctrineResult,
    GameState,
    IresRuntimeState
} from '../../types';
import { resolveIresRuleset } from '../ires/config';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const RESTED_PRESERVE_PRODUCTIVE_BONUS = 16;
export const RESTED_TRUE_REST_BONUS = 18;
export const RESTED_REENTRY_BONUS = 20;
export const RESTED_EXIT_LOW_PAYOFF_PENALTY = 20;
export const RESTED_EXIT_STANDARD_PENALTY = 8;
export const STABLE_HOLD_BONUS = 6;
export const DROP_TO_CAUTION_PENALTY = 12;
export const DROP_TO_CRITICAL_PENALTY = 24;
export const EXHAUSTION_ENTRY_PENALTY = 60;
export const ACT_WHILE_EXHAUSTED_PENALTY = 80;
export const SECOND_ACTION_OVERREACH_PENALTY = 18;
export const THIRD_ACTION_OVERREACH_PENALTY = 32;

type SparkDoctrineActionType = 'WAIT' | 'MOVE' | 'USE_SKILL';

export interface CandidatePayoffInput {
    visibleHostileCount: number;
    directDamage: number;
    killCount: number;
    objectiveDelta: number;
    intentEstimateValue: number;
    targetRuleScore: number;
    canDamageNow: boolean;
    createsThreatNextDecision: boolean;
    improvesObjective: boolean;
    usefulReposition: boolean;
    hasControlIntent: boolean;
    hasHazardIntent: boolean;
}

export interface RestedOpportunityCandidate {
    actionType: SparkDoctrineActionType;
    payoff: AiCandidatePayoff;
    assessment?: AiSparkAssessment;
}

export interface SparkDoctrineEvaluationInput {
    actionType: SparkDoctrineActionType;
    payoff: AiCandidatePayoff;
    assessment: AiSparkAssessment;
    restedOpportunityMode: AiRestedOpportunityMode;
    hasStandardOrBetterNonExhaustingAlternative: boolean;
    disciplineMultiplier?: number;
}

const isRestedBand = (band: AiSparkBand): boolean => band === 'rested_hold' || band === 'rested_edge';
const isStableOrBetterBand = (band: AiSparkBand): boolean => isRestedBand(band) || band === 'stable';
const isProductivePayoff = (payoff: AiCandidatePayoff): boolean => payoff === 'big_payoff' || payoff === 'standard_payoff';

const cadenceMultiplier = (assessment: AiSparkAssessment): number =>
    assessment.isThirdActionOrLater
        ? 1.8
        : assessment.isSecondAction
            ? 1.35
            : 1;

const payoffPenaltyDiscount = (payoff: AiCandidatePayoff): number => {
    switch (payoff) {
        case 'big_payoff':
            return 0.35;
        case 'standard_payoff':
            return 0.75;
        default:
            return 1;
    }
};

const applyPenaltyDiscount = (penalty: number, payoff: AiCandidatePayoff): number =>
    penalty * payoffPenaltyDiscount(payoff);

export const classifyAiSparkBand = (
    ires: IresRuntimeState | null | undefined,
    ruleset?: GameState['ruleset'] | null
): AiSparkBand => {
    if (!ires) return 'rested_hold';
    const config = resolveIresRuleset(ruleset || undefined);
    const sparkRatio = clamp01(Number(ires.spark || 0) / Math.max(1, Number(ires.maxSpark || 1)));
    if (ires.currentState === 'exhausted' || sparkRatio <= Number(config.exhaustedEnterSparkRatio || 0.2)) {
        return 'exhausted';
    }
    if (ires.currentState === 'rested') {
        if (sparkRatio >= Number(config.restedEnterSparkRatio || 0.8)) return 'rested_hold';
        if (sparkRatio >= Number(config.restedExitSparkBelow || 0.5)) return 'rested_edge';
    }
    if (sparkRatio >= 0.55) return 'stable';
    if (sparkRatio >= 0.35) return 'caution';
    if (sparkRatio > Number(config.exhaustedEnterSparkRatio || 0.2)) return 'critical';
    return 'exhausted';
};

export const classifyCandidatePayoff = ({
    visibleHostileCount,
    directDamage,
    killCount,
    objectiveDelta,
    intentEstimateValue,
    targetRuleScore,
    canDamageNow,
    createsThreatNextDecision,
    improvesObjective,
    usefulReposition,
    hasControlIntent,
    hasHazardIntent
}: CandidatePayoffInput): AiCandidatePayoff => {
    if (
        killCount > 0
        || directDamage >= 8
        || (intentEstimateValue >= 14 && (hasControlIntent || hasHazardIntent))
        || (visibleHostileCount <= 0 && objectiveDelta >= 2)
    ) {
        return 'big_payoff';
    }

    if (
        canDamageNow
        || createsThreatNextDecision
        || improvesObjective
        || intentEstimateValue >= 8
        || targetRuleScore >= 8
    ) {
        return 'standard_payoff';
    }

    if (usefulReposition) {
        return 'low_payoff';
    }

    return 'non_productive';
};

export const classifyRestedOpportunityMode = (
    candidates: RestedOpportunityCandidate[]
): AiRestedOpportunityMode => {
    const productiveRestedPreserve = candidates.some(candidate =>
        !!candidate.assessment
        && candidate.assessment.wouldPreserveRested
        && isProductivePayoff(candidate.payoff)
    );
    if (productiveRestedPreserve) {
        return 'productive_preserve';
    }

    const setupTrueRest = candidates.some(candidate =>
        candidate.actionType === 'WAIT'
        && !!candidate.assessment
        && candidate.assessment.isTrueRestTurn
        && (candidate.assessment.wouldPreserveRested || candidate.assessment.wouldReenterRested)
    );
    return setupTrueRest ? 'setup_preserve' : 'battery_only';
};

export const evaluateSparkDoctrine = ({
    actionType,
    payoff,
    assessment,
    restedOpportunityMode,
    hasStandardOrBetterNonExhaustingAlternative,
    disciplineMultiplier = 1
}: SparkDoctrineEvaluationInput): AiSparkDoctrineResult => {
    const cadence = cadenceMultiplier(assessment) * Math.max(0.9, Math.min(1.1, disciplineMultiplier));
    const override = payoff === 'big_payoff'
        ? 'big_payoff'
        : (
            assessment.sparkBandBefore === 'rested_hold'
            && assessment.fullSparkBurstWindow
            && assessment.wouldEnterExhausted
            && payoff !== 'low_payoff'
            && payoff !== 'non_productive'
            && !hasStandardOrBetterNonExhaustingAlternative
        )
            ? 'surge_only_option'
            : 'none';

    const voluntaryExhaustionAttempt = assessment.wouldEnterExhausted || assessment.wouldActWhileExhausted;
    const voluntaryExhaustionAllowed = voluntaryExhaustionAttempt && (
        override === 'big_payoff'
        || override === 'surge_only_option'
    );

    if (assessment.wouldActWhileExhausted && override === 'none') {
        return {
            allowed: false,
            gateReason: 'blocked_while_exhausted',
            sparkScoreDelta: -1000,
            override,
            restedDecision: 'none',
            waitForBandPreservation: false,
            voluntaryExhaustionAttempt,
            voluntaryExhaustionAllowed
        };
    }

    if (assessment.wouldEnterExhausted && override === 'none') {
        return {
            allowed: false,
            gateReason: 'blocked_exhaustion_entry',
            sparkScoreDelta: -1000,
            override,
            restedDecision: 'none',
            waitForBandPreservation: false,
            voluntaryExhaustionAttempt,
            voluntaryExhaustionAllowed
        };
    }

    if (
        assessment.isThirdActionOrLater
        && assessment.wouldEnterExhausted
        && override === 'none'
    ) {
        return {
            allowed: false,
            gateReason: 'blocked_third_action_exhaustion',
            sparkScoreDelta: -1000,
            override,
            restedDecision: 'none',
            waitForBandPreservation: false,
            voluntaryExhaustionAttempt,
            voluntaryExhaustionAllowed
        };
    }

    if (
        isRestedBand(assessment.sparkBandBefore)
        && assessment.wouldExitRested
        && payoff === 'non_productive'
    ) {
        return {
            allowed: false,
            gateReason: 'blocked_nonproductive_rested_break',
            sparkScoreDelta: -1000,
            override,
            restedDecision: 'none',
            waitForBandPreservation: false,
            voluntaryExhaustionAttempt,
            voluntaryExhaustionAllowed
        };
    }

    let bonus = 0;
    let penalty = 0;
    let restedDecision: AiSparkDoctrineResult['restedDecision'] = 'none';

    if (assessment.isTrueRestTurn && actionType === 'WAIT' && (assessment.wouldPreserveRested || assessment.wouldReenterRested)) {
        bonus += RESTED_TRUE_REST_BONUS;
        restedDecision = 'true_rest';
    } else if (actionType === 'WAIT' && assessment.wouldReenterRested) {
        bonus += RESTED_REENTRY_BONUS;
        restedDecision = 'reenter';
    } else if (restedOpportunityMode === 'productive_preserve' && assessment.wouldPreserveRested && isProductivePayoff(payoff)) {
        bonus += RESTED_PRESERVE_PRODUCTIVE_BONUS;
        restedDecision = 'preserve';
    } else if (restedOpportunityMode === 'battery_only' && assessment.wouldExitRested && isProductivePayoff(payoff)) {
        restedDecision = 'spend_battery';
    }

    if (isStableOrBetterBand(assessment.sparkBandIfEndedNow)) {
        bonus += STABLE_HOLD_BONUS;
    }

    if (assessment.wouldReenterRested && actionType === 'WAIT') {
        bonus += RESTED_REENTRY_BONUS;
    }

    if (assessment.wouldExitRested) {
        if (restedOpportunityMode === 'productive_preserve' || restedOpportunityMode === 'setup_preserve') {
            penalty += payoff === 'standard_payoff'
                ? RESTED_EXIT_STANDARD_PENALTY
                : RESTED_EXIT_LOW_PAYOFF_PENALTY;
        } else if (payoff === 'low_payoff' || payoff === 'non_productive') {
            penalty += RESTED_EXIT_LOW_PAYOFF_PENALTY;
        }
    }

    if (assessment.wouldDropBelowStable) {
        penalty += DROP_TO_CAUTION_PENALTY * cadence;
    }
    if (assessment.wouldDropBelowCaution) {
        penalty += DROP_TO_CRITICAL_PENALTY * cadence;
    }
    if (assessment.wouldEnterExhausted) {
        penalty += EXHAUSTION_ENTRY_PENALTY * cadence;
    }
    if (assessment.wouldActWhileExhausted) {
        penalty += ACT_WHILE_EXHAUSTED_PENALTY * cadence;
    }
    if (assessment.isSecondAction && (assessment.wouldExitRested || assessment.wouldDropBelowStable || voluntaryExhaustionAttempt)) {
        penalty += SECOND_ACTION_OVERREACH_PENALTY;
    }
    if (assessment.isThirdActionOrLater) {
        penalty += THIRD_ACTION_OVERREACH_PENALTY;
    }

    const discountedPenalty = applyPenaltyDiscount(penalty, payoff);
    const waitForBandPreservation = actionType === 'WAIT'
        && (
            assessment.isTrueRestTurn
            || assessment.wouldPreserveRested
            || assessment.wouldReenterRested
            || isStableOrBetterBand(assessment.sparkBandIfEndedNow)
        );

    return {
        allowed: true,
        gateReason: 'none',
        sparkScoreDelta: bonus - discountedPenalty,
        override,
        restedDecision,
        waitForBandPreservation,
        voluntaryExhaustionAttempt,
        voluntaryExhaustionAllowed
    };
};
