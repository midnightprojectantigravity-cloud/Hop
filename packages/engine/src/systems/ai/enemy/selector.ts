import type { Intent } from '../../../types/intent';
import type { AiDecision, AiScoreBreakdown } from '../core/types';
import { selectGenericUnitAiAction } from '../generic-unit-ai';
import type { EnemyAiContext, EnemyAiDecisionResult } from './types';

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

const toDecisionAction = (action: ReturnType<typeof selectGenericUnitAiAction>['selected']['action']): AiDecision['action'] => {
    if (action.type === 'WAIT') {
        return { type: 'WAIT', skillId: 'WAIT_SKILL' };
    }
    if (action.type === 'MOVE') {
        return { type: 'MOVE', skillId: 'BASIC_MOVE', targetHex: action.payload };
    }
    if (action.type === 'USE_SKILL' && action.payload.skillId === 'BASIC_ATTACK') {
        return { type: 'ATTACK', skillId: 'BASIC_ATTACK', targetHex: action.payload.target };
    }
    return {
        type: 'USE_SKILL',
        skillId: action.type === 'USE_SKILL' ? action.payload.skillId : 'WAIT_SKILL',
        targetHex: action.type === 'USE_SKILL' ? action.payload.target : undefined
    };
};

const toIntentString = (decision: AiDecision['action']): string => {
    if (decision.type === 'WAIT') return 'Waiting';
    if (decision.type === 'MOVE') return 'Moving';
    if (decision.skillId === 'BOMB_TOSS') return 'Bombing';
    return decision.skillId || 'Waiting';
};

const toBreakdown = (source: Record<string, number>): AiScoreBreakdown => ({
    total: Object.values(source).reduce((sum, value) => sum + value, 0),
    features: { ...source },
    weights: Object.fromEntries(Object.keys(source).map(key => [key, 1])),
    contributions: { ...source }
});

const buildSelectedDecision = (
    context: EnemyAiContext
): { result: EnemyAiDecisionResult; scored: EnemyScoredCandidateDebug[] } => {
    const generic = selectGenericUnitAiAction({
        state: context.state,
        actor: context.enemy,
        side: context.enemy.factionId === 'player' ? 'companion' : 'enemy',
        simSeed: `${context.state.initialSeed || context.state.rngSeed || 'enemy-ai'}:${context.enemy.id}`,
        decisionCounter: Number(context.state.rngCounter || 0)
    });

    const scored = generic.candidates.map((candidate, index) => ({
        index,
        id: `${candidate.skillId || candidate.reasoningCode}:${index}`,
        source: 'shared_generic',
        reasoningCode: candidate.reasoningCode,
        preScore: 0,
        total: candidate.score,
        tacticalTotal: candidate.score,
        intentTotal: 0,
        intent: undefined,
        intentPosition: candidate.target,
        position: candidate.action.type === 'MOVE' ? candidate.action.payload : context.enemy.position,
        rngCounter: context.state.rngCounter,
        message: undefined,
        breakdown: toBreakdown(candidate.breakdown)
    }));

    const decisionAction = toDecisionAction(generic.selected.action);
    const plannedEntity = {
        ...context.enemy,
        position: generic.selected.action.type === 'MOVE' ? generic.selected.action.payload : context.enemy.position,
        intent: toIntentString(decisionAction),
        intentPosition: decisionAction.targetHex
    };
    const decision: AiDecision = {
        action: decisionAction,
        reasoningCode: generic.selected.reasoningCode,
        expectedValue: generic.selected.score,
        breakdown: toBreakdown(generic.selected.breakdown),
        rngConsumption: 0
    };

    return {
        result: {
            plannedEntity,
            nextState: context.state,
            message: generic.selected.action.type === 'MOVE'
                ? `${context.enemy.subtype || context.enemy.id} moves to (${plannedEntity.position.q}, ${plannedEntity.position.r})`
                : undefined,
            decision,
            selectedFacts: generic.selected.facts,
            selectionSummary: generic.summary
        },
        scored
    };
};

const snapshotFromResult = (result: EnemyAiDecisionResult): EnemyAiTurnTraceSelectionSnapshot => ({
    selectedSource: 'shared_generic',
    selectedCandidateId: result.decision.reasoningCode,
    position: result.plannedEntity.position,
    intent: result.plannedEntity.intent,
    intentPosition: result.plannedEntity.intentPosition,
    actionCooldown: result.plannedEntity.actionCooldown,
    facing: result.plannedEntity.facing,
    isVisible: result.plannedEntity.isVisible,
    nextRngCounter: result.nextState.rngCounter,
    message: result.message
});

export const selectEnemyDecision = (context: EnemyAiContext): EnemyAiDecisionResult => {
    const selected = buildSelectedDecision(context).result;
    const traceHook = (globalThis as any).__HOP_ENEMY_AI_TURN_TRACE_HOOK__ as EnemyAiTurnTraceHook | undefined;
    const runtimeDecisionContext = (globalThis as any).__HOP_ENEMY_AI_RUNTIME_DECISION_CONTEXT__ as
        | { actorId?: string; floor?: number; turnNumber?: number; rngCounter?: number }
        | undefined;

    if (traceHook && runtimeDecisionContext?.actorId === context.enemy.id) {
        const snapshot = snapshotFromResult(selected);
        traceHook({
            runId: (globalThis as any).__HOP_ENEMY_AI_TRACE_RUN_ID__ as string | undefined,
            floor: runtimeDecisionContext.floor ?? context.state.floor,
            turnNumber: runtimeDecisionContext.turnNumber ?? context.state.turnNumber,
            rngCounter: runtimeDecisionContext.rngCounter ?? context.state.rngCounter,
            enemyId: context.enemy.id,
            enemySubtype: context.enemy.subtype,
            enemyPosition: context.enemy.position,
            playerPosition: context.playerPos,
            withPolicyExact: snapshot,
            syntheticOnly: snapshot
        });
    }

    return selected;
};

export const scoreEnemyCandidatesForDebug = (
    context: EnemyAiContext,
    _options: EnemySelectorDebugOptions = {}
) => {
    const built = buildSelectedDecision(context);
    return {
        scored: built.scored,
        weights: {},
        intentWeights: {}
    };
};

export const selectEnemyDecisionWithOracleDiff = (
    context: EnemyAiContext,
    _options: EnemySelectorDebugOptions = {}
): EnemyDecisionSelectionDebug => {
    const built = buildSelectedDecision(context);
    return {
        selected: built.result,
        oracle: built.result,
        usedOracleFallback: false,
        mismatchReason: undefined,
        selectedCandidateId: built.result.decision.reasoningCode,
        selectedSource: 'shared_generic',
        scoredCandidates: built.scored
    };
};

export const decideEnemyIntent = (
    context: EnemyAiContext
): Intent => {
    const selected = selectEnemyDecision(context);
    const action = selected.decision.action;
    return {
        type: action.type,
        actorId: context.enemy.id,
        skillId: action.skillId || 'WAIT_SKILL',
        primaryTargetId: action.primaryTargetId,
        targetHex: action.targetHex,
        priority: 10,
        metadata: {
            expectedValue: selected.decision.expectedValue || 0,
            reasoningCode: selected.decision.reasoningCode || 'SHARED_GENERIC',
            isGhost: false,
            rngConsumption: selected.decision.rngConsumption || 0,
            aiTelemetry: {
                selectedFacts: selected.selectedFacts,
                selectionSummary: selected.selectionSummary
            }
        }
    };
};
