import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import { appendTrace, clonePoint } from './execution-context';
import { evaluateRuntimeSkillPredicate, resolveRuntimeSkillActorById, resolveRuntimeSkillTargetActor } from './targeting';
import type { PointResolutionContext } from './point-resolution';
import type { CombatScriptInstruction, ResolutionTrace, ResolutionTraceMode, ResolvedSkillRuntime, SkillPhysicsPlan, SkillCollisionPolicy } from './types';

export type LoweringExecutionContext = PointResolutionContext & {
    attackerTurnStartPosition?: Point;
    allActorsTurnStartPositions?: Map<string, Point>;
    collisionPolicy?: SkillCollisionPolicy;
    physicsPlan: SkillPhysicsPlan;
};

type RuntimeContext = Record<string, any>;

export const createLoweringExecutionContext = (
    resolved: ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    target: Point | undefined,
    runtimeContext: RuntimeContext,
    executionTrace: ResolutionTrace
): LoweringExecutionContext => {
    const targetActor = resolveRuntimeSkillTargetActor(state, target);
    const context: LoweringExecutionContext = {
        initialCasterPosition: clonePoint(attacker.position),
        selectedHex: target ? clonePoint(target) : undefined,
        targetActorId: targetActor?.id,
        previousNeighbors: runtimeContext.previousNeighbors,
        attackerTurnStartPosition: runtimeContext.attackerTurnStartPosition,
        allActorsTurnStartPositions: runtimeContext.allActorsTurnStartPositions,
        persistentTargetIds: runtimeContext.persistentTargetIds,
        actorPositions: new Map<string, Point>([[attacker.id, clonePoint(attacker.position)]]),
        collisionPolicy: resolved.physicsPlan.collision,
        physicsPlan: resolved.physicsPlan,
        trace: executionTrace,
        rngState: {
            rngSeed: state.rngSeed,
            rngCounter: state.rngCounter
        },
        rngConsumption: 0,
        pointSetCache: new Map<string, Point[]>()
    };
    if (targetActor) {
        context.actorPositions.set(targetActor.id, clonePoint(targetActor.position));
    }
    return context;
};

export const resolveInstructionConditionContext = (
    state: GameState,
    context: LoweringExecutionContext,
    attacker: Actor
): {
    conditionAttacker: Actor;
    conditionTargetActor?: Actor;
    conditionPoint: Point;
} => {
    const conditionAttacker = {
        ...attacker,
        position: clonePoint(context.initialCasterPosition)
    };
    const conditionTargetActor = (
        context.projectileTrace?.impactActorId
            ? resolveRuntimeSkillActorById(state, context.projectileTrace.impactActorId)
            : undefined
    ) || (
        context.targetActorId
            ? resolveRuntimeSkillActorById(state, context.targetActorId)
            : undefined
    ) || resolveRuntimeSkillTargetActor(state, context.selectedHex);
    const conditionPoint = conditionTargetActor?.position
        || context.selectedHex
        || context.initialCasterPosition;
    return {
        conditionAttacker,
        conditionTargetActor,
        conditionPoint
    };
};

export const instructionPassesRuntimeConditions = (
    instruction: CombatScriptInstruction,
    resolved: ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    context: LoweringExecutionContext,
    executionTrace: ResolutionTrace,
    traceMode: ResolutionTraceMode
): boolean => {
    if (!instruction.conditions?.length) return true;
    const { conditionAttacker, conditionTargetActor, conditionPoint } = resolveInstructionConditionContext(state, context, attacker);
    const passesConditions = instruction.conditions.every(predicate =>
        evaluateRuntimeSkillPredicate(
            predicate,
            state,
            conditionAttacker,
            conditionPoint,
            executionTrace,
            {
                targetActor: conditionTargetActor,
                candidateActor: conditionTargetActor,
                projectileImpactKind: context.projectileTrace?.impactKind,
                resolvedKeywords: resolved.resolvedKeywords,
                previousNeighbors: context.previousNeighbors,
                persistentTargetIds: context.persistentTargetIds
            }
        )
    );
    if (!passesConditions) {
        appendTrace(executionTrace, {
            kind: 'instruction',
            path: `combatScript.${instruction.id || instruction.kind}.conditions`,
            message: `Skipped ${instruction.kind} because its runtime conditions failed.`
        });
    }
    return passesConditions;
};
