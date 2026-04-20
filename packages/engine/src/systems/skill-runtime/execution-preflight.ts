import type { Actor, GameState, Point } from '../../types';
import { createTrace } from './execution-context';
import { getRuntimeExecutionHandler } from './handler-registry';
import { resolveSkillRuntime } from './resolve';
import { resolveStunnedPreconditionResult, validateResolvedSkillTarget } from './execution-validation';
import type { ResolutionTraceMode, SkillExecutionWithRuntimeResult, SkillRuntimeDefinition, ResolvedSkillRuntime } from './types';

export type RuntimeExecutionPreflight =
    | {
        kind: 'stunned';
        result: SkillExecutionWithRuntimeResult;
    }
    | {
        kind: 'empty';
        resolved: ResolvedSkillRuntime;
    }
    | {
        kind: 'missing_target';
        resolved: ResolvedSkillRuntime;
        executionTrace: ReturnType<typeof createTrace>;
        message: string;
    }
    | {
        kind: 'validated';
        resolved: ResolvedSkillRuntime;
        targetToUse: Point;
        runtimeContext: Record<string, any>;
    };

export const preflightRuntimeExecution = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    target: Point | undefined,
    activeUpgradeIds: string[],
    traceMode: ResolutionTraceMode,
    runtimeContext: Record<string, any>
): RuntimeExecutionPreflight => {
    const resolved = resolveSkillRuntime(definition, activeUpgradeIds, traceMode, { state, attacker });
    const stunnedResult = resolveStunnedPreconditionResult(definition, resolved, state, attacker, traceMode);
    if (stunnedResult) {
        return { kind: 'stunned', result: stunnedResult };
    }
    if (resolved.combatScript.length === 0) {
        return { kind: 'empty', resolved };
    }
    const targetToUse = target || (resolved.targeting.generator === 'self' ? attacker.position : undefined);
    const targetingTrace = createTrace(traceMode);
    if (!targetToUse) {
        return {
            kind: 'missing_target',
            resolved,
            executionTrace: targetingTrace,
            message: definition.validationMessages?.missingTarget || 'A target is required.'
        };
    }
    const validationFailure = validateResolvedSkillTarget(resolved, definition, state, attacker, targetToUse, targetingTrace);
    if (validationFailure) {
        return {
            kind: 'stunned',
            result: validationFailure
        };
    }
    const executionHandler = getRuntimeExecutionHandler(definition.handlerRefs?.execution);
    if (executionHandler) {
        return {
            kind: 'stunned',
            result: executionHandler({
                definition,
                resolved,
                state,
                attacker,
                target: targetToUse
            })
        };
    }
    return {
        kind: 'validated',
        resolved,
        targetToUse,
        runtimeContext
    };
};
