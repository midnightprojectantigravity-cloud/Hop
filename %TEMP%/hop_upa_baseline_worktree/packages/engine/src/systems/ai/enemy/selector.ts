import { scoreFeatures } from '../core/scoring';
import type { AiDecision, AiScoreBreakdown } from '../core/types';
import { deriveEnemyCandidateFeatures, deriveEnemyDecisionFeatures, deriveEnemyIntentLayerFeatures } from './features';
import { buildEnemyPlannedCandidates, type EnemyCandidateBuildOptions } from './candidates';
import { getEnemyPolicyProfile, planEnemyActionByPolicy, type EnemyPlannerResult } from './policies';
import { plannedResultToEnemyAiDecisionResult } from './decision-adapter';
import type { EnemyAiContext, EnemyAiDecisionResult, EnemyAiPlannedCandidate } from './types';
import { toEnemyIntent } from './intent-adapter';
import type { Intent } from '../../../types/intent';
import { hexEquals } from '../../../hex';
import {
    deriveEnemyDynamicIntentBias,
    getDynamicEnemyIntentBiasStrength,
    isDynamicEnemyIntentBiasEnabled
} from './personality';

interface EnemyScoredCandidateInternal {
    index: number;
    candidate: EnemyAiPlannedCandidate;
    result: EnemyAiDecisionResult;
    tacticalBreakdown: AiScoreBreakdown;
    intentBreakdown: AiScoreBreakdown;
    breakdown: AiScoreBreakdown;
    total: number;
}

export interface EnemyAiTurnTraceSelectionSnapshot {
    selectedSource?: string;
    selectedCandidateId?: string;
    position: EnemyAiContext['enemy']['position'];
    intent?: string;
    intentPosition?: EnemyAiContext['enemy']['intentPosition'];
    actionCooldown?: number;
    facing?: number;
    isVisible?: boolean;
    nextRngCounter?: number;
    message?: string;
}

export interface EnemyAiTurnTraceEvent {
    runId?: string;
    floor: number;
    turnNumber: number;
    rngCounter?: number;
    enemyId: string;
    enemySubtype?: string;
    enemyPosition: EnemyAiContext['enemy']['position'];
    playerPosition: EnemyAiContext['playerPos'];
    withPolicyExact: EnemyAiTurnTraceSelectionSnapshot;
    syntheticOnly: EnemyAiTurnTraceSelectionSnapshot;
}

export type EnemyAiTurnTraceHook = (event: EnemyAiTurnTraceEvent) => void;

export interface EnemyScoredCandidateDebug {
    index: number;
    id: string;
    source: string;
    reasoningCode: string;
    preScore: number;
    total: number;
    tacticalTotal: number;
    intentTotal: number;
    intent: string | undefined;
    intentPosition?: EnemyAiContext['enemy']['intentPosition'];
    position: EnemyAiContext['enemy']['position'];
    rngCounter: number | undefined;
    message?: string;
    breakdown: AiScoreBreakdown;
}

export interface EnemyDecisionSelectionDebug {
    selected: EnemyAiDecisionResult;
    usedOracleFallback: boolean;
    mismatchReason?: string;
    oracle: EnemyAiDecisionResult;
    selectedCandidateId?: string;
    selectedSource?: string;
    scoredCandidates: EnemyScoredCandidateDebug[];
}

export interface EnemySelectorDebugOptions {
    includePolicyExact?: boolean;
}

interface EnemySelectionBundle {
    selected: EnemyAiDecisionResult;
    scoredResult: ReturnType<typeof scoreEnemyCandidates>;
    selectedCandidate?: EnemyScoredCandidateInternal;
}

const enemyCandidateWeights = (context: EnemyAiContext, policy: ReturnType<typeof getEnemyPolicyProfile>) => {
    const subtype = context.enemy.subtype || 'default';
    const rangedSubtype = subtype === 'archer' || subtype === 'warlock' || subtype === 'bomber';
    const meleeSubtype = !rangedSubtype;
    const readCalibrationEnv = (key: string, min: number, max: number): number => {
        if (!isDynamicEnemyIntentBiasEnabled()) return 0;
        const raw = process.env?.[key];
        if (!raw) return 0;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return 0;
        return Math.max(min, Math.min(max, parsed));
    };
    const bomberBombWindowBonus = subtype === 'bomber'
        ? readCalibrationEnv('HOP_ENEMY_AI_BOMBER_BOMB_WINDOW_BONUS', -50, 50)
        : 0;
    const bomberRepositionBonus = subtype === 'bomber'
        ? readCalibrationEnv('HOP_ENEMY_AI_BOMBER_REPOSITION_BONUS', -50, 50)
        : 0;
    const baseWeights: Record<string, number> = {
        candidate_pre_score: 1,
        is_wait_action: -8,
        is_move_action: meleeSubtype ? 1 : 0.6,
        is_attack_action: meleeSubtype ? 5 : 2,
        is_skill_action: rangedSubtype ? 3 : 1.5,
        moved: 0.5,
        dist_delta_toward_player: meleeSubtype ? 1 : -0.2,
        preferred_range_match: 2,
        has_target_hex: 0.4,
        target_adjacent_to_player: subtype === 'bomber' ? 2 : 0.2,
        target_is_player_tile: subtype === 'bomber' ? -4 : 0,
        uses_signature_skill: 1.5,
        raider_dash_window_match: subtype === 'raider' ? 25 : 0,
        pouncer_hook_window_match: subtype === 'pouncer' ? 25 : 0,
        archer_ranged_window_match: subtype === 'archer' ? 16 : 0,
        archer_melee_window_match: subtype === 'archer' ? 16 : 0,
        bomber_bomb_window_match: subtype === 'bomber' ? (18 + bomberBombWindowBonus) : 0,
        bomber_bomb_target_valid_shape: subtype === 'bomber' ? 12 : 0,
        bomber_reposition_candidate: subtype === 'bomber' ? bomberRepositionBonus : 0,
        sentinel_phase_telegraph_match: subtype === 'sentinel' ? 40 : 0,
        sentinel_phase_execute_match: subtype === 'sentinel' ? 45 : 0,
        sentinel_phase_mismatch: subtype === 'sentinel' ? -60 : 0,
        cooldown_delta_positive: rangedSubtype ? 0.4 : 0.2,
        rng_consumption: 0,
        message_present: 0.1,
        // base context features retained for diagnostics
        dist_to_player: 0,
        adjacent_to_player: 0,
        hostile_hidden: 0,
        enemy_hp: 0,
        enemy_action_cooldown: 0,
        dist_before: 0,
        dist_after: 0
    };

    if (!isDynamicEnemyIntentBiasEnabled()) {
        return baseWeights;
    }

    const strength = getDynamicEnemyIntentBiasStrength();
    if (strength <= 0) {
        return baseWeights;
    }

    const bias = deriveEnemyDynamicIntentBias(context, policy);
    const leverage = 0.45 * strength;
    const hpRatio = Math.max(0, Number(context.enemy.hp || 0)) / Math.max(1, Number(context.enemy.maxHp || 1));
    const lowHpPressure = Math.max(0, 1 - hpRatio);
    const isBomber = subtype === 'bomber';
    const moveCoeff = isBomber ? 0 : 0.4;
    const skillCoeff = isBomber ? 1.35 : 1.1;
    const lowHpWaitCoeff = isBomber ? 1.5 : 6;
    const lowHpMoveCoeff = isBomber ? 0.15 : 1.0;

    return {
        ...baseWeights,
        is_wait_action: baseWeights.is_wait_action + ((bias.defense * 1.4 * leverage) + (bias.defense * lowHpPressure * lowHpWaitCoeff * leverage)),
        is_move_action: baseWeights.is_move_action + ((bias.positioning * moveCoeff * leverage) + (bias.defense * lowHpPressure * lowHpMoveCoeff * leverage)),
        is_attack_action: baseWeights.is_attack_action + (bias.offense * 0.85 * leverage),
        is_skill_action: baseWeights.is_skill_action + ((bias.control * skillCoeff * leverage) + (bias.offense * 0.2 * leverage)),
        dist_delta_toward_player: baseWeights.dist_delta_toward_player + ((bias.offense - bias.defense) * 0.2 * leverage),
        preferred_range_match: baseWeights.preferred_range_match + (bias.positioning * 0.2 * leverage)
    };
};

const computeDynamicIntentLayerScale = (): number => {
    if (!isDynamicEnemyIntentBiasEnabled()) return 1;
    const strength = getDynamicEnemyIntentBiasStrength();
    if (strength <= 1) return 1;
    return 1 + ((strength - 1) * 3);
};

const enemyIntentWeights = (context: EnemyAiContext) => {
    const subtype = context.enemy.subtype || 'default';
    const tacticalControlSubtype = subtype === 'sentinel' || subtype === 'warlock' || subtype === 'raider' || subtype === 'pouncer';
    const dynamicIntentScaleBase = computeDynamicIntentLayerScale();
    const dynamicIntentScale = subtype === 'bomber'
        ? 1 + ((dynamicIntentScaleBase - 1) * 0.15)
        : dynamicIntentScaleBase;
    return {
        intent_is_offense: 0,
        intent_is_positioning: 0,
        intent_is_control: 0,
        intent_is_defense: 0,
        intent_desire_offense: 0,
        intent_desire_positioning: 0,
        intent_desire_control: 0,
        intent_desire_defense: 0,
        intent_selected_desire: 0.25 * dynamicIntentScale,
        intent_dominant_match: (tacticalControlSubtype ? 0.9 : 0.7) * dynamicIntentScale,
        intent_preferred_range_gap: 0,
        intent_player_hidden: 0
    } as const;
};

const mergeBreakdowns = (
    tactical: AiScoreBreakdown,
    intent: AiScoreBreakdown,
    total: number
): AiScoreBreakdown => ({
    total,
    features: {
        ...tactical.features,
        ...intent.features
    },
    weights: {
        ...tactical.weights,
        ...intent.weights
    },
    contributions: {
        ...tactical.contributions,
        ...intent.contributions
    }
});

const scaleBreakdown = (breakdown: AiScoreBreakdown, scale: number): AiScoreBreakdown => {
    if (scale === 1) return breakdown;
    return {
        total: breakdown.total * scale,
        features: { ...breakdown.features },
        weights: Object.fromEntries(
            Object.entries(breakdown.weights).map(([k, v]) => [k, Number(v) * scale])
        ),
        contributions: Object.fromEntries(
            Object.entries(breakdown.contributions).map(([k, v]) => [k, Number(v) * scale])
        )
    };
};

const finalizeEnemyDecisionResult = (
    context: EnemyAiContext,
    policyPlannedResult: EnemyPlannerResult
): EnemyAiDecisionResult => {
    const policy = getEnemyPolicyProfile(context.enemy.subtype);
    const features = deriveEnemyDecisionFeatures(context);
    const breakdown = scoreFeatures(features, {
        dist_to_player: 0,
        adjacent_to_player: 0,
        hostile_hidden: 0,
        enemy_hp: 0,
        enemy_action_cooldown: 0
    });

    const result = plannedResultToEnemyAiDecisionResult(context.enemy, context.state, policyPlannedResult);
    const decision: AiDecision = {
        ...result.decision,
        expectedValue: 0,
        breakdown: {
            ...breakdown,
            weights: {
                ...breakdown.weights,
                policy_id: 0
            },
            features: {
                ...breakdown.features,
                policy_tag_count: policy.tags?.length || 0
            },
            contributions: {
                ...breakdown.contributions,
                policy_tag_count: 0,
                policy_id: 0
            }
        }
    };

    return { ...result, decision };
};

const samePoint = (
    a?: EnemyAiContext['enemy']['position'],
    b?: EnemyAiContext['enemy']['position']
): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return hexEquals(a, b);
};

const samePlannerOutcome = (a: EnemyAiDecisionResult, b: EnemyAiDecisionResult): string | undefined => {
    if (JSON.stringify(a.plannedEntity) !== JSON.stringify(b.plannedEntity)) return 'plannedEntity';
    if (!samePoint(a.plannedEntity.position, b.plannedEntity.position)) return 'position';
    if (String(a.plannedEntity.intent || '') !== String(b.plannedEntity.intent || '')) return 'intent';
    if (!samePoint(a.plannedEntity.intentPosition, b.plannedEntity.intentPosition)) return 'intentPosition';
    if ((a.plannedEntity.actionCooldown ?? undefined) !== (b.plannedEntity.actionCooldown ?? undefined)) return 'actionCooldown';
    if ((a.plannedEntity.facing ?? undefined) !== (b.plannedEntity.facing ?? undefined)) return 'facing';
    if ((a.plannedEntity.isVisible ?? undefined) !== (b.plannedEntity.isVisible ?? undefined)) return 'isVisible';
    if ((a.nextState.rngCounter ?? undefined) !== (b.nextState.rngCounter ?? undefined)) return 'rngCounter';
    if (String(a.message || '') !== String(b.message || '')) return 'message';
    return undefined;
};

const scoreEnemyCandidates = (context: EnemyAiContext, options: EnemySelectorDebugOptions = {}) => {
    const policy = getEnemyPolicyProfile(context.enemy.subtype);
    const candidateOptions: EnemyCandidateBuildOptions = {
        includePolicyExact: options.includePolicyExact
    };
    const candidates = buildEnemyPlannedCandidates(context, candidateOptions);
    const weights = enemyCandidateWeights(context, policy);
    const intentWeights = enemyIntentWeights(context);
    const intentLayerScale = computeDynamicIntentLayerScale();

    const scored: EnemyScoredCandidateInternal[] = candidates.map((candidate, index) => {
        const result = plannedResultToEnemyAiDecisionResult(context.enemy, context.state, candidate.planned);
        const candidateFeatures = deriveEnemyCandidateFeatures(context, candidate, result.decision, policy);
        const intentFeatures = deriveEnemyIntentLayerFeatures(context, candidate, result.decision, policy);
        const tacticalBreakdown = scoreFeatures(candidateFeatures, weights);
        const rawIntentBreakdown = scoreFeatures(intentFeatures, intentWeights as Record<string, number>);
        const intentBreakdown = scaleBreakdown(rawIntentBreakdown, intentLayerScale);
        const total = tacticalBreakdown.total + intentBreakdown.total + Number(candidate.preScore || 0);
        return {
            index,
            candidate,
            result,
            tacticalBreakdown,
            intentBreakdown,
            breakdown: mergeBreakdowns(tacticalBreakdown, intentBreakdown, total),
            total
        };
    });

    scored.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if ((b.candidate.preScore || 0) !== (a.candidate.preScore || 0)) {
            return Number(b.candidate.preScore || 0) - Number(a.candidate.preScore || 0);
        }
        return a.index - b.index;
    });

    return { scored, weights, intentWeights };
};

const selectedFromScoredCandidate = (
    item: EnemyScoredCandidateInternal
): EnemyAiDecisionResult => ({
    ...item.result,
    decision: {
        ...item.result.decision,
        reasoningCode: item.candidate.reasoningCode,
        expectedValue: item.total,
        breakdown: item.breakdown
    }
});

const selectEquivalentSyntheticCandidate = (
    top: EnemyScoredCandidateInternal,
    scored: EnemyScoredCandidateInternal[]
): EnemyScoredCandidateInternal => {
    if (top.candidate.source !== 'policy_exact') return top;
    const topResult = selectedFromScoredCandidate(top);
    for (const candidate of scored) {
        if (candidate.candidate.source === 'policy_exact') continue;
        const candidateResult = selectedFromScoredCandidate(candidate);
        if (samePlannerOutcome(candidateResult, topResult) === undefined) {
            return candidate;
        }
    }
    return top;
};

const noCandidateDecision = (context: EnemyAiContext): EnemyAiDecisionResult => {
    const breakdown = scoreFeatures({}, {});
    return {
        plannedEntity: { ...context.enemy, intent: 'Waiting', intentPosition: undefined },
        nextState: context.state,
        message: undefined,
        decision: {
            action: {
                type: 'WAIT',
                skillId: 'WAIT_SKILL'
            },
            reasoningCode: 'NO_CANDIDATES_WAIT',
            expectedValue: Number.NEGATIVE_INFINITY,
            breakdown,
            rngConsumption: 0
        }
    };
};

const selectEnemyDecisionFromScoring = (
    context: EnemyAiContext,
    options: EnemySelectorDebugOptions = {}
): EnemySelectionBundle => {
    const scoredResult = scoreEnemyCandidates(context, options);
    if (scoredResult.scored.length === 0) {
        return {
            selected: noCandidateDecision(context),
            scoredResult,
            selectedCandidate: undefined as EnemyScoredCandidateInternal | undefined
        };
    }

    const top = scoredResult.scored[0];
    const selectedCandidate = selectEquivalentSyntheticCandidate(top, scoredResult.scored);

    return {
        selected: selectedFromScoredCandidate(selectedCandidate),
        scoredResult,
        selectedCandidate
    };
};

const snapshotFromBundle = (bundle: EnemySelectionBundle): EnemyAiTurnTraceSelectionSnapshot => ({
    selectedSource: bundle.selectedCandidate?.candidate.source,
    selectedCandidateId: bundle.selectedCandidate?.candidate.id,
    position: bundle.selected.plannedEntity.position,
    intent: bundle.selected.plannedEntity.intent,
    intentPosition: bundle.selected.plannedEntity.intentPosition,
    actionCooldown: bundle.selected.plannedEntity.actionCooldown,
    facing: bundle.selected.plannedEntity.facing,
    isVisible: bundle.selected.plannedEntity.isVisible,
    nextRngCounter: bundle.selected.nextState.rngCounter,
    message: bundle.selected.message
});

export const selectEnemyDecision = (context: EnemyAiContext): EnemyAiDecisionResult => {
    const runtimeBundle = selectEnemyDecisionFromScoring(context);
    const traceHook = (globalThis as any).__HOP_ENEMY_AI_TURN_TRACE_HOOK__ as EnemyAiTurnTraceHook | undefined;
    const runtimeDecisionContext = (globalThis as any).__HOP_ENEMY_AI_RUNTIME_DECISION_CONTEXT__ as
        | { actorId?: string; floor?: number; turnNumber?: number; rngCounter?: number }
        | undefined;
    if (
        traceHook
        && runtimeDecisionContext
        && runtimeDecisionContext.actorId === context.enemy.id
    ) {
        try {
            const withPolicyExactBundle = selectEnemyDecisionFromScoring(context, { includePolicyExact: true });
            const syntheticOnlyBundle = selectEnemyDecisionFromScoring(context, { includePolicyExact: false });
            traceHook({
                runId: (globalThis as any).__HOP_ENEMY_AI_TRACE_RUN_ID__ as string | undefined,
                floor: runtimeDecisionContext.floor ?? context.state.floor,
                turnNumber: runtimeDecisionContext.turnNumber ?? context.state.turnNumber,
                rngCounter: runtimeDecisionContext.rngCounter ?? context.state.rngCounter,
                enemyId: context.enemy.id,
                enemySubtype: context.enemy.subtype,
                enemyPosition: context.enemy.position,
                playerPosition: context.playerPos,
                withPolicyExact: snapshotFromBundle(withPolicyExactBundle),
                syntheticOnly: snapshotFromBundle(syntheticOnlyBundle)
            });
        } catch {
            // Trace hooks must never affect runtime AI behavior.
        }
    }

    return runtimeBundle.selected;
};

export const scoreEnemyCandidatesForDebug = (
    context: EnemyAiContext,
    options: EnemySelectorDebugOptions = {}
) => {
    const scoredResult = scoreEnemyCandidates(context, options);
    return {
        scored: scoredResult.scored,
        weights: scoredResult.weights,
        intentWeights: scoredResult.intentWeights
    };
};

export const selectEnemyDecisionWithOracleDiff = (
    context: EnemyAiContext,
    options: EnemySelectorDebugOptions = {}
): EnemyDecisionSelectionDebug => {
    const oracle = finalizeEnemyDecisionResult(context, planEnemyActionByPolicy(context));
    const { selected, scoredResult, selectedCandidate } = selectEnemyDecisionFromScoring(context, options);
    const mismatchReason = samePlannerOutcome(selected, oracle);

    return {
        selected,
        oracle,
        usedOracleFallback: false,
        mismatchReason,
        selectedCandidateId: selectedCandidate?.candidate.id,
        selectedSource: selectedCandidate?.candidate.source,
        scoredCandidates: scoredResult.scored.map(item => ({
            index: item.index,
            id: item.candidate.id,
            source: item.candidate.source,
            reasoningCode: item.candidate.reasoningCode,
            preScore: Number(item.candidate.preScore || 0),
            total: item.total,
            tacticalTotal: item.tacticalBreakdown.total,
            intentTotal: item.intentBreakdown.total,
            intent: item.candidate.planned.entity.intent,
            intentPosition: item.candidate.planned.entity.intentPosition,
            position: item.candidate.planned.entity.position,
            rngCounter: item.candidate.planned.nextState.rngCounter,
            message: item.candidate.planned.message,
            breakdown: item.breakdown
        }))
    };
};

export const decideEnemyIntent = (
    context: EnemyAiContext
): Intent => {
    const selected = selectEnemyDecision(context);
    return toEnemyIntent(selected.decision, context.enemy, context.state);
};
