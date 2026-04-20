import type { Actor, GameState, Point } from '../../types';
import type { PointResolutionContext } from './point-resolution';
import type {
    RuntimePointFilter,
    RuntimePointPattern,
    RuntimePointSet,
    RuntimeTargetFanOut
} from './types';

export type MessageMaterializationDeps = {
    resolveActorRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Actor | Point | undefined;
    resolveRuntimeMovementPolicy: (
        runtime: any,
        state: GameState,
        actor: Actor,
        destination?: Point
    ) => { range?: number } | undefined;
    resolveRuntimeSkillActorById: (state: GameState, actorId: string) => Actor | undefined;
    resolveInstructionPointTargets: (
        target: any,
        pointSet: RuntimePointSet | undefined,
        pointPattern: RuntimePointPattern | undefined,
        targetFanOut: RuntimeTargetFanOut | undefined,
        pointFilters: RuntimePointFilter[] | undefined,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext,
        deps: any
    ) => Array<{ actor?: Actor; effectTarget: Point | string; point: Point }>;
    resolveActorLabel: (actor: Actor, state: GameState) => string;
    pointResolutionDeps: any;
};

export const resolveMovementSummaryMessage = (
    instruction: { actor?: any; includeResolvedRange?: boolean; text?: string },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolved: { runtime: { baseVariables: { range?: number } } },
    deps: MessageMaterializationDeps
): string => {
    const messageActor = deps.resolveActorRef(instruction.actor || 'self', attacker, state, context) as Actor | undefined;
    if (!messageActor) return instruction.text || '';
    const resolvedRange = instruction.includeResolvedRange
        ? deps.resolveRuntimeMovementPolicy(resolved.runtime, state, messageActor, context.selectedHex)?.range
        : undefined;
    const suffix = resolvedRange !== undefined ? ` [Range ${resolvedRange}]` : '';
    return `${deps.resolveActorLabel(messageActor, state)} moved to (${messageActor.position.q}, ${messageActor.position.r}).${suffix}`;
};

export const materializeAttackSummaryMessages = (
    instruction: {
        actor?: any;
        targetActor?: any;
        pointSet?: RuntimePointSet;
        pointPattern?: RuntimePointPattern;
        targetFanOut?: RuntimeTargetFanOut;
        pointFilters?: RuntimePointFilter[];
        actionVerb?: string;
        recordMessage?: boolean;
        emitEffect?: boolean;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: MessageMaterializationDeps
): { messages: string[]; effects: Array<{ type: 'Message'; text: string }> } => {
    const messageActor = deps.resolveActorRef(instruction.actor || 'self', attacker, state, context) as Actor | undefined;
    if (!messageActor) return { messages: [], effects: [] };
    const messageTargets = deps.resolveInstructionPointTargets(
        instruction.targetActor || 'target_actor',
        instruction.pointSet,
        instruction.pointPattern,
        instruction.targetFanOut,
        instruction.pointFilters,
        attacker,
        state,
        context,
        deps.pointResolutionDeps
    );
    const actionVerb = instruction.actionVerb || 'attacked';
    const messages: string[] = [];
    const effects: Array<{ type: 'Message'; text: string }> = [];
    for (const messageTarget of messageTargets) {
        const targetActor = messageTarget.actor
            || (typeof messageTarget.effectTarget === 'string'
                ? deps.resolveRuntimeSkillActorById(state, messageTarget.effectTarget)
                : undefined);
        if (!targetActor) continue;
        const message = `${deps.resolveActorLabel(messageActor, state)} ${actionVerb} ${deps.resolveActorLabel(targetActor, state).toLowerCase()}!`;
        if (instruction.recordMessage !== false) messages.push(message);
        if (instruction.emitEffect !== false) effects.push({ type: 'Message', text: message });
    }
    return { messages, effects };
};
