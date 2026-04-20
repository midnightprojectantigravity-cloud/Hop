import { hexDistance, hexEquals } from '../../hex';
import type { Actor, GameState, Point } from '../../types';
import { createTrace } from './execution-context';
import { resolveRuntimeSkillTargetActor } from './targeting';
import type { ResolutionTraceMode, ResolvedSkillRuntime, SkillRuntimeDefinition, SkillExecutionWithRuntimeResult } from './types';
import { isRuntimeSkillTargetValid, resolveRuntimeSkillValidTargets } from './targeting';

export const resolveStunnedPreconditionResult = (
    definition: SkillRuntimeDefinition,
    resolved: ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    traceMode: ResolutionTraceMode
): SkillExecutionWithRuntimeResult | undefined => {
    if (!definition.preconditions?.some(precondition => precondition.kind === 'stunned')) return undefined;
    const stunnedThisStep = (state.timelineEvents || []).some(ev =>
        ev.phase === 'STATUS_APPLY'
        && ev.type === 'ApplyStatus'
        && ev.payload?.status === 'stunned'
        && (
            ev.payload?.target === attacker.id
            || (
                typeof ev.payload?.target === 'object'
                && ev.payload?.target
                && hexEquals(ev.payload.target as Point, attacker.position)
            )
        )
    );
    const isStunnedNow = attacker.statusEffects?.some(status => status.type === 'stunned') || stunnedThisStep;
    if (!isStunnedNow) return undefined;
    const precondition = definition.preconditions.find(candidate => candidate.kind === 'stunned')!;
    return {
        effects: [],
        messages: precondition.message ? [precondition.message] : [],
        consumesTurn: precondition.consumesTurn,
        rngConsumption: 0,
        resolvedRuntime: resolved,
        executionTrace: createTrace(traceMode)
    };
};

export const validateResolvedSkillTarget = (
    resolved: ResolvedSkillRuntime,
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    targetToUse: Point,
    targetingTrace: ReturnType<typeof createTrace>
): SkillExecutionWithRuntimeResult | undefined => {
    const validTargets = resolveRuntimeSkillValidTargets(resolved, state, attacker, targetingTrace);
    const isValid = validTargets.some(candidate => hexEquals(candidate, targetToUse))
        || (resolved.targeting.generator === 'self' && hexEquals(targetToUse, attacker.position))
        || isRuntimeSkillTargetValid(resolved, state, attacker, targetToUse, targetingTrace);
    if (isValid) return undefined;
    const targetActor = resolveRuntimeSkillTargetActor(state, targetToUse);
    const validationMessage = hexDistance(attacker.position, targetToUse) > resolved.targeting.range
        ? definition.validationMessages?.outOfRange
        : !targetActor || targetActor.id === attacker.id
            ? definition.validationMessages?.noTargetActor
            : targetActor.factionId === attacker.factionId
                ? definition.validationMessages?.friendlyTarget
                : definition.validationMessages?.invalidTarget;
    return {
        effects: [],
        messages: [validationMessage || 'Invalid target.'],
        consumesTurn: false,
        rngConsumption: 0,
        resolvedRuntime: resolved,
        executionTrace: targetingTrace
    };
};
