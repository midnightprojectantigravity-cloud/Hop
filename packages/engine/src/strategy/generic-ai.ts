import type { Actor, GameState } from '../types';
import type { Intent, IStrategyProvider } from '../types/intent';
import {
    selectGenericUnitAiAction,
    type GenericUnitAiCandidate,
    type GenericUnitAiSelectionSummary,
    type GenericUnitAiSide
} from '../systems/ai/generic-unit-ai';

export interface GenericAiRuntimeTraceEvent {
    actorId: string;
    side: GenericUnitAiSide;
    turnNumber: number;
    rngCounter?: number;
    selected: GenericUnitAiCandidate;
    candidates: GenericUnitAiCandidate[];
    summary: GenericUnitAiSelectionSummary;
}

export type GenericAiRuntimeTraceHook = (event: GenericAiRuntimeTraceEvent) => void;

const resolveActorSide = (state: GameState, actor: Actor): GenericUnitAiSide => {
    if (actor.id === state.player.id) return 'player';
    if (actor.factionId === 'player') return 'companion';
    return 'enemy';
};

const toIntent = (
    actor: Actor,
    selection: ReturnType<typeof selectGenericUnitAiAction>
): Intent => {
    const chosen = selection.selected;
    const action = chosen.action;

    if (action.type === 'WAIT') {
        return {
            type: 'WAIT',
            actorId: actor.id,
            skillId: 'WAIT_SKILL',
            priority: 10,
            metadata: {
                expectedValue: chosen.score,
                reasoningCode: chosen.reasoningCode,
                isGhost: false,
                aiTelemetry: {
                    selectedFacts: chosen.facts,
                    selectionSummary: selection.summary
                }
            }
        };
    }

    if (action.type === 'MOVE') {
        return {
            type: 'MOVE',
            actorId: actor.id,
            skillId: 'BASIC_MOVE',
            targetHex: action.payload,
            priority: 10,
            metadata: {
                expectedValue: chosen.score,
                reasoningCode: chosen.reasoningCode,
                isGhost: false,
                aiTelemetry: {
                    selectedFacts: chosen.facts,
                    selectionSummary: selection.summary
                }
            }
        };
    }

    const isBasicAttack = action.payload.skillId === 'BASIC_ATTACK';
    return {
        type: isBasicAttack ? 'ATTACK' : 'USE_SKILL',
        actorId: actor.id,
        skillId: action.payload.skillId,
        targetHex: action.payload.target,
        priority: 10,
        metadata: {
            expectedValue: chosen.score,
            reasoningCode: chosen.reasoningCode,
            isGhost: false,
            aiTelemetry: {
                selectedFacts: chosen.facts,
                selectionSummary: selection.summary
            }
        }
    };
};

export class GenericAiStrategy implements IStrategyProvider {
    getIntent(gameState: GameState, actor: Actor): Intent {
        const side = resolveActorSide(gameState, actor);
        const selection = selectGenericUnitAiAction({
            state: gameState,
            actor,
            side,
            simSeed: `${gameState.initialSeed || gameState.rngSeed || 'generic-ai'}:${actor.id}`,
            decisionCounter: Number(gameState.rngCounter || 0),
            goal: actor.behaviorState?.goal
        });

        const hook = (globalThis as any).__HOP_GENERIC_AI_RUNTIME_TRACE_HOOK__ as GenericAiRuntimeTraceHook | undefined;
        const shouldTraceLiveDecision = (globalThis as any).__HOP_GENERIC_AI_RUNTIME_TRACE_LIVE_ONLY__ === true;
        if (hook && shouldTraceLiveDecision) {
            hook({
                actorId: actor.id,
                side,
                turnNumber: gameState.turnNumber,
                rngCounter: gameState.rngCounter,
                selected: selection.selected,
                candidates: selection.candidates,
                summary: selection.summary
            });
        }

        return toIntent(actor, selection);
    }
}
