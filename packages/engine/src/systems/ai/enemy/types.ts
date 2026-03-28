import type { Entity, GameState, Point } from '../../../types';
import type { AiDecision } from '../core/types';
import type { GenericUnitAiCandidateFacts, GenericUnitAiSelectionSummary } from '../generic-unit-ai';

export interface EnemyAiContext {
    enemy: Entity;
    playerPos: Point;
    state: GameState & { occupiedCurrentTurn?: Point[] };
}

export interface EnemyAiPolicyProfile {
    id: string;
    subtype?: string;
    preferredRange?: number | [number, number];
    tags?: string[];
}

export interface EnemyAiDecisionResult {
    plannedEntity: Entity;
    nextState: GameState;
    message?: string;
    decision: AiDecision<GameState>;
    selectedFacts?: GenericUnitAiCandidateFacts;
    selectionSummary?: GenericUnitAiSelectionSummary;
}

export interface EnemyAiPlannedCandidate {
    id: string;
    source: 'policy_exact' | 'synthetic';
    reasoningCode: string;
    preScore?: number;
    planned: {
        entity: Entity;
        nextState: GameState;
        message?: string;
    };
}
