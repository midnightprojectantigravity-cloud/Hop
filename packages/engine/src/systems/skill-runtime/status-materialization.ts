import type { Actor, GameState, Point } from '../../types';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';
import type { RuntimePointFilter, RuntimePointPattern, RuntimePointSet, RuntimeTargetFanOut } from './types';

export type StatusMaterializationDeps = {
    resolveActorRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Actor | Point | undefined;
    resolveInstructionPointTargets: (
        target: any,
        pointSet: RuntimePointSet | undefined,
        pointPattern: RuntimePointPattern | undefined,
        targetFanOut: RuntimeTargetFanOut | undefined,
        pointFilters: RuntimePointFilter[] | undefined,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext,
        deps: PointResolutionDependencies
    ) => Array<{ actor?: Actor; effectTarget: Point | string; point: Point }>;
    pointResolutionDeps: PointResolutionDependencies;
};

export const materializeApplyStatusInstruction = (
    instruction: {
        target: any;
        pointSet?: RuntimePointSet;
        pointPattern?: RuntimePointPattern;
        targetFanOut?: RuntimeTargetFanOut;
        pointFilters?: RuntimePointFilter[];
        combatPointTargetMode?: 'proxy_actor' | 'actor_only' | 'actor_or_proxy';
        status: any;
        duration?: number;
        message?: string;
    },
    attacker: Actor,
    state: GameState,
    target: Point | undefined,
    context: PointResolutionContext,
    deps: StatusMaterializationDeps
): { effects: Array<any>; messages: string[] } => {
    const effects: Array<any> = [];
    const messages: string[] = [];
    const resolvedTargets = deps.resolveInstructionPointTargets(
        instruction.target,
        instruction.pointSet,
        instruction.pointPattern,
        instruction.targetFanOut,
        instruction.pointFilters,
        attacker,
        state,
        context,
        deps.pointResolutionDeps
    );
    if (resolvedTargets.length > 0) {
        for (const resolvedTarget of resolvedTargets) {
            const applyStatusTarget = instruction.target === 'self'
                ? 'self'
                : instruction.combatPointTargetMode === 'proxy_actor'
                    ? resolvedTarget.point
                    : resolvedTarget.actor?.id || resolvedTarget.effectTarget;
            effects.push({
                type: 'ApplyStatus',
                target: applyStatusTarget,
                status: instruction.status,
                duration: instruction.duration
            });
        }
        if (instruction.message) {
            messages.push(instruction.message);
            effects.push({ type: 'Message', text: instruction.message });
        }
        return { effects, messages };
    }

    const targetRef = instruction.target === 'selected_hex'
        ? target
        : deps.resolveActorRef(instruction.target, attacker, state, context);
    if (!targetRef) return { effects: [], messages: [] };
    effects.push({
        type: 'ApplyStatus',
        target: instruction.target === 'self'
            ? 'self'
            : typeof targetRef === 'object' && 'id' in targetRef
                ? targetRef.id
                : targetRef,
        status: instruction.status,
        duration: instruction.duration
    });
    if (instruction.message) {
        messages.push(instruction.message);
        effects.push({ type: 'Message', text: instruction.message });
    }
    return { effects, messages };
};

export const materializeSetStealthInstruction = (
    instruction: { target: any; amount: number },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolveActorRef: StatusMaterializationDeps['resolveActorRef']
): Array<any> => {
    const actorRef = resolveActorRef(instruction.target, attacker, state, context);
    if (!actorRef || typeof actorRef !== 'object' || !('id' in actorRef)) return [];
    return [{
        type: 'SetStealth',
        target: actorRef.id === attacker.id ? 'self' : actorRef.id,
        amount: instruction.amount
    }];
};

export const materializeHealInstruction = (
    instruction: { target: any; amount: number },
    attacker: Actor,
    state: GameState,
    target: Point | undefined,
    context: PointResolutionContext,
    resolveActorRef: StatusMaterializationDeps['resolveActorRef']
): Array<any> => {
    const targetRef = instruction.target === 'selected_hex'
        ? target
        : resolveActorRef(instruction.target, attacker, state, context);
    if (!targetRef) return [];
    return [{
        type: 'Heal',
        target: instruction.target === 'self'
            ? 'self'
            : typeof targetRef === 'object' && 'id' in targetRef
                ? targetRef.id
                : 'targetActor',
        amount: instruction.amount
    }];
};
