import type { GameState, Point } from '../../../types';

export type AiDecisionActionType = 'WAIT' | 'MOVE' | 'ATTACK' | 'USE_SKILL';

export interface AiDecisionAction {
    type: AiDecisionActionType;
    skillId?: string;
    targetHex?: Point;
    primaryTargetId?: string;
}

export interface AiCandidate<TMetadata = unknown> {
    action: AiDecisionAction;
    reasoningCode: string;
    preScore?: number;
    metadata?: TMetadata;
}

export type AiFeatureVector = Record<string, number>;

export interface AiScoreBreakdown {
    total: number;
    features: Record<string, number>;
    weights: Record<string, number>;
    contributions: Record<string, number>;
}

export type AiTieBreakContext = object;

export interface AiChoiceResult<TState = unknown> {
    index: number;
    nextState?: TState;
    rngConsumption?: number;
}

export interface AiChoiceSource<TState = unknown, TContext = AiTieBreakContext> {
    chooseIndex(length: number, context: TContext): AiChoiceResult<TState>;
}

export interface AiDecision<TState = GameState> {
    action: AiDecisionAction;
    reasoningCode: string;
    expectedValue: number;
    breakdown?: AiScoreBreakdown;
    nextState?: TState;
    rngConsumption?: number;
}
