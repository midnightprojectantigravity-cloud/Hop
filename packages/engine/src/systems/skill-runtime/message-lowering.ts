import type { Actor, GameState, Point } from '../../types';
import { resolveActorLabel } from './execution-context';
import { materializeAttackSummaryMessages, resolveMovementSummaryMessage } from './message-materialization';
import { resolveRuntimeMovementPolicy, resolveRuntimeSkillActorById } from './targeting';
import type { LoweringExecutionContext } from './execution-lowering';
import type { PointResolutionDependencies } from './point-resolution';
import type { ResolvedSkillRuntime, MessageInstruction } from './types';

type MessageDeps = {
    resolveActorRef: any;
    resolveInstructionPointTargets: any;
    pointResolutionDeps: PointResolutionDependencies;
};

export const materializeRuntimeMessageInstruction = (
    instruction: MessageInstruction,
    attacker: Actor,
    state: GameState,
    context: LoweringExecutionContext,
    resolved: ResolvedSkillRuntime,
    deps: MessageDeps
): { messages: string[]; effects: { type: 'Message'; text: string }[] } => {
    const messageText = instruction.format === 'movement_summary'
        ? resolveMovementSummaryMessage(
            instruction,
            attacker,
            state,
            context,
            resolved,
            {
                resolveActorRef: deps.resolveActorRef,
                resolveRuntimeMovementPolicy,
                resolveRuntimeSkillActorById,
                resolveInstructionPointTargets: deps.resolveInstructionPointTargets,
                resolveActorLabel,
                pointResolutionDeps: deps.pointResolutionDeps
            }
        )
        : instruction.format === 'attack_summary'
            ? ''
            : instruction.text;
    if (instruction.format === 'attack_summary') {
        const summary = materializeAttackSummaryMessages(
            instruction,
            attacker,
            state,
            context,
            {
                resolveActorRef: deps.resolveActorRef,
                resolveRuntimeMovementPolicy,
                resolveRuntimeSkillActorById,
                resolveInstructionPointTargets: deps.resolveInstructionPointTargets,
                resolveActorLabel,
                pointResolutionDeps: deps.pointResolutionDeps
            }
        );
        return {
            messages: summary.messages,
            effects: summary.effects
        };
    }
    const messages = instruction.recordMessage !== false ? [messageText] : [];
    const effects: { type: 'Message'; text: string }[] = instruction.emitEffect !== false
        ? [{ type: 'Message', text: messageText }]
        : [];
    return { messages, effects };
};
