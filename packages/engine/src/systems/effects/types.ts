import type { Actor, AtomicEffect, GameState, Point, SimulationEvent, TimelinePhase } from '../../types';

export interface AtomicEffectContext {
    targetId?: string;
    sourceId?: string;
    stepId?: string;
}

export type SimulationEventDraft = Omit<SimulationEvent, 'id' | 'turn'>;

export interface AtomicEffectHandlerApi {
    applyAtomicEffect: (state: GameState, effect: AtomicEffect, context?: AtomicEffectContext) => GameState;
    applyEffects: (state: GameState, effects: AtomicEffect[], context?: AtomicEffectContext) => GameState;
    addCorpseTraitAt: (state: GameState, position: Point) => GameState;
    removeCorpseTraitAt: (state: GameState, position: Point) => GameState;
    scaleCombatProfileDamage: (
        state: GameState,
        rawAmount: number,
        sourceId: string | undefined,
        target: Actor | undefined,
        damageClass: 'physical' | 'magical',
        reason?: string
    ) => { amount: number; outgoing: number; incoming: number; total: number };
    appendSimulationEvent: (state: GameState, event: SimulationEventDraft) => GameState;
    appendTimelineEvent: (
        state: GameState,
        phase: TimelinePhase,
        type: string,
        payload: any,
        context: AtomicEffectContext,
        blocking: boolean,
        suggestedDurationMs: number
    ) => GameState;
    getBlockingTimelineDurationMs: (events?: GameState['timelineEvents']) => number;
    legacyMirroredJuiceIds: ReadonlySet<string>;
    resolveActorAt: (state: GameState, pos?: Point | null) => Actor | undefined;
    resolveActorById: (state: GameState, actorId?: string) => Actor | undefined;
}

export type AtomicEffectHandlerMap = Partial<{
    [K in AtomicEffect['type']]: (
        state: GameState,
        effect: Extract<AtomicEffect, { type: K }>,
        context: AtomicEffectContext,
        api: AtomicEffectHandlerApi
    ) => GameState;
}>;
