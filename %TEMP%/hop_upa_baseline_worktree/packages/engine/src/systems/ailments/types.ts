import type { Actor, GameState } from '../../types';
import type { AilmentID } from '../../types/registry';
import type { AilmentDefinition } from '../../data/ailments';
import type { AilmentFormulaExpression } from '../../data/ailments';
import type { AtomicEffectContext } from '../effects/types';

export interface AilmentRuntimeContext {
    sourceId?: string;
    targetId?: string;
    reason?: string;
    stepId?: string;
}

export interface AilmentCounterChange {
    ailment: AilmentID;
    before: number;
    after: number;
    delta: number;
}

export interface AilmentDepositRequest {
    ailment: AilmentID;
    amount: number;
    source?: 'skill' | 'tile' | 'system';
}

export interface AilmentTriggerResult {
    triggerValue: number;
    roll: number;
    applied: boolean;
    deposited: number;
    nextState: GameState;
}

export interface AilmentActorState {
    counters: Partial<Record<AilmentID, number>>;
    xp: Partial<Record<AilmentID, number>>;
    resistancePct: Partial<Record<AilmentID, number>>;
    baseResistancePct: Partial<Record<AilmentID, number>>;
    resistanceGrowthRate: number;
}

export interface AilmentTickResult {
    nextState: GameState;
    damageApplied: number;
    decayApplied: number;
}

export interface AilmentApplicationInput {
    ailment: AilmentDefinition;
    source: Actor;
    target: Actor;
    skillMultiplier: number;
    baseDeposit: number;
}

export interface AilmentFormulaContext {
    currentCounters: number;
    resiliencePct: number;
    maxHp: number;
    body: number;
    mind: number;
    instinct: number;
}

export interface AilmentAnnihilationDelta {
    incoming: AilmentID;
    against: AilmentID;
    incomingNeutralized: number;
    opposingConsumed: number;
    ratio: number;
}

export interface AilmentAnnihilationResult {
    counters: Partial<Record<AilmentID, number>>;
    deposited: number;
    deltas: AilmentAnnihilationDelta[];
}

export interface AilmentApplicationComputation {
    triggerValue: number;
    roll: number;
    applied: boolean;
    depositAmount: number;
}

export interface AilmentHardeningGainResult {
    actor: Actor;
    previousPct: number;
    nextPct: number;
    gainedPct: number;
    previousXp: number;
    nextXp: number;
}

export interface AilmentTickComputation {
    damage: number;
    decay: number;
}

export interface AilmentTickInput {
    definition: AilmentDefinition;
    counters: number;
    formulaContext: AilmentFormulaContext;
}

export interface AilmentTickOutput {
    nextCounters: number;
    damage: number;
    decay: number;
    thresholdEffects: string[];
}

export interface AilmentRuntimeApplyContext {
    effectContext?: AtomicEffectContext;
    source?: 'skill' | 'tile' | 'system';
}

export interface AilmentRuntimeResolvedTarget {
    actorId: string;
    actor: Actor;
}

export type AilmentExpression = AilmentFormulaExpression | undefined;
