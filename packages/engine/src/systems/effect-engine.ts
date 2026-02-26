import type { GameState, AtomicEffect, Actor, Point, TimelineEvent, TimelinePhase, StackResolutionTick, SimulationEvent } from '../types';
import { hexEquals, pointToKey } from '../hex';
import { checkVitals } from './entities/actor';
import { BASE_TILES } from './tiles/tile-registry';
import { getIncomingDamageMultiplier, getOutgoingDamageMultiplier } from './combat/combat-traits';
import { resolveLifoStack } from './resolution-stack';
import { tryApplyRegisteredAtomicEffect } from './effects/registry';
import type { AtomicEffectContext } from './effects/types';

const addCorpseTraitAt = (state: GameState, position: Point): GameState => {
    const key = pointToKey(position);
    let nextState = state;
    if (nextState.tiles === state.tiles) {
        nextState = { ...nextState, tiles: new Map(nextState.tiles) };
    }

    let tile = nextState.tiles.get(key);
    if (!tile) {
        tile = {
            baseId: 'STONE',
            position,
            traits: new Set(BASE_TILES.STONE!.defaultTraits),
            effects: []
        };
    } else {
        tile = {
            ...tile,
            traits: new Set(tile.traits),
            effects: [...tile.effects]
        };
    }
    tile.traits.add('CORPSE');
    nextState.tiles.set(key, tile);
    return nextState;
};

const removeCorpseTraitAt = (state: GameState, position: Point): GameState => {
    const key = pointToKey(position);
    const existing = state.tiles.get(key);
    if (!existing || !existing.traits.has('CORPSE')) return state;

    let nextState = state;
    if (nextState.tiles === state.tiles) {
        nextState = { ...nextState, tiles: new Map(nextState.tiles) };
    }
    const updatedTile = {
        ...existing,
        traits: new Set(existing.traits),
        effects: [...existing.effects]
    };
    updatedTile.traits.delete('CORPSE');
    nextState.tiles.set(key, updatedTile);
    return nextState;
};

const EFFECT_WARN = typeof process !== 'undefined' && (process.env?.HOP_ENGINE_WARN === '1' || process.env?.HOP_ENGINE_DEBUG === '1');
const TIMELINE_PHASE_ORDER: Record<TimelinePhase, number> = {
    INTENT_START: 1,
    MOVE_START: 2,
    MOVE_END: 3,
    ON_PASS: 4,
    ON_ENTER: 5,
    HAZARD_CHECK: 6,
    STATUS_APPLY: 7,
    DAMAGE_APPLY: 8,
    DEATH_RESOLVE: 9,
    INTENT_END: 10
};

const getBlockingTimelineDurationMs = (events?: TimelineEvent[]): number => {
    const list = events || [];
    let total = 0;
    for (const ev of list) {
        if (!ev.blocking) continue;
        total += Number(ev.suggestedDurationMs || 0);
    }
    return total;
};

const appendTimelineEvent = (
    state: GameState,
    phase: 'MOVE_START' | 'MOVE_END' | 'ON_PASS' | 'ON_ENTER' | 'HAZARD_CHECK' | 'STATUS_APPLY' | 'DAMAGE_APPLY' | 'DEATH_RESOLVE' | 'INTENT_START' | 'INTENT_END',
    type: string,
    payload: any,
    context: AtomicEffectContext,
    blocking: boolean,
    suggestedDurationMs: number
): GameState => {
    const events = state.timelineEvents || [];
    const idx = events.length;
    const turn = state.turnNumber || 0;
    const actorId = context.sourceId || context.targetId;
    const groupId = context.stepId || `${turn}:${actorId || 'system'}`;
    const stepId = context.stepId || groupId;
    const previousStepEvent = stepId
        ? [...events].reverse().find(ev => (ev.stepId || ev.groupId) === stepId)
        : undefined;
    if (previousStepEvent) {
        const prevOrder = TIMELINE_PHASE_ORDER[previousStepEvent.phase as TimelinePhase] || 0;
        const nextOrder = TIMELINE_PHASE_ORDER[phase as TimelinePhase] || 0;
        if (prevOrder > nextOrder && EFFECT_WARN) {
            console.warn('[TURN_STACK] Non-monotonic timeline phase order detected.', {
                stepId,
                previous: previousStepEvent.phase,
                next: phase
            });
        }
    }
    const id = `${stepId}:${idx}:${phase}`;
    return {
        ...state,
        timelineEvents: [
            ...events,
            {
                id,
                turn,
                actorId,
                stepId,
                phase,
                type,
                payload,
                blocking,
                groupId,
                suggestedDurationMs
            }
        ]
    };
};

const appendSimulationEvent = (
    state: GameState,
    event: Omit<SimulationEvent, 'id' | 'turn'>
): GameState => {
    const events = state.simulationEvents || [];
    const id = `sim:${state.turnNumber || 0}:${events.length}:${event.type}`;
    return {
        ...state,
        simulationEvents: [
            ...events,
            {
                ...event,
                id,
                turn: state.turnNumber || 0
            }
        ]
    };
};

const resolveActorById = (state: GameState, actorId?: string): Actor | undefined => {
    if (!actorId) return undefined;
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
};

const resolveActorAt = (state: GameState, pos?: Point | null): Actor | undefined => {
    if (!pos) return undefined;
    if (hexEquals(state.player.position, pos)) return state.player;
    return state.enemies.find(e => hexEquals(e.position, pos)) || state.companions?.find(e => hexEquals(e.position, pos));
};

const HAZARD_REASONS = new Set(['lava_sink', 'void_sink', 'hazard_intercept', 'lava_tick', 'fire_damage', 'burning', 'oil_explosion']);
const LEGACY_MIRRORED_JUICE_IDS = new Set(['impact', 'flash', 'spearTrail', 'shake']);

const scaleCombatProfileDamage = (
    state: GameState,
    rawAmount: number,
    sourceId: string | undefined,
    target: Actor | undefined,
    damageClass: 'physical' | 'magical',
    reason?: string
): { amount: number; outgoing: number; incoming: number; total: number } => {
    if (!target) return { amount: rawAmount, outgoing: 1, incoming: 1, total: 1 };
    if (reason && HAZARD_REASONS.has(reason)) return { amount: rawAmount, outgoing: 1, incoming: 1, total: 1 };
    const source = resolveActorById(state, sourceId);
    if (!source) return { amount: rawAmount, outgoing: 1, incoming: 1, total: 1 };
    const outgoing = getOutgoingDamageMultiplier(source, damageClass);
    const incoming = getIncomingDamageMultiplier(target, damageClass);
    const total = outgoing * incoming;
    const amount = Math.max(0, Math.floor(rawAmount * total));
    return { amount, outgoing, incoming, total };
};


/**
 * Apply a single atomic effect to the game state.
 */
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: AtomicEffectContext = {}): GameState => {
    const nextState = { ...state };

    const registeredResult = tryApplyRegisteredAtomicEffect(nextState, effect, context, {
        applyAtomicEffect,
        applyEffects,
        addCorpseTraitAt,
        removeCorpseTraitAt,
        scaleCombatProfileDamage,
        appendSimulationEvent,
        appendTimelineEvent,
        getBlockingTimelineDurationMs,
        legacyMirroredJuiceIds: LEGACY_MIRRORED_JUICE_IDS,
        resolveActorAt,
        resolveActorById
    });
    if (registeredResult) {
        return registeredResult;
    }

    return nextState;
};



/**
 * Apply a list of effects to the game state.
 */
export const applyEffects = (state: GameState, effects: AtomicEffect[], context: AtomicEffectContext = {}): GameState => {
    // Legacy themeInterceptors decommissioned. 
    // Hazard logic is now unified in TileResolver and executed during Displacement or turn ends.
    const baseTraceOffset = state.stackTrace?.length || 0;
    const baseResolution = resolveLifoStack(state, effects, {
        apply: (s, effect) => applyAtomicEffect(s, effect, context),
        describe: (effect) => effect.type,
        preserveInputOrder: true,
        startTick: baseTraceOffset + 1
    });

    let nextState = baseResolution.state;
    let mergedTrace: StackResolutionTick[] = [
        ...(state.stackTrace || []),
        ...baseResolution.trace
    ];

    // Post-Effect Vitals Check (Life & Death)
    const vitalEffects = checkVitals(nextState);
    if (vitalEffects.length > 0) {
        const vitalResolution = resolveLifoStack(nextState, vitalEffects, {
            apply: (s, effect) => applyAtomicEffect(s, effect, {}),
            describe: (effect) => effect.type,
            preserveInputOrder: true,
            startTick: mergedTrace.length + 1
        });
        nextState = vitalResolution.state;
        mergedTrace = [...mergedTrace, ...vitalResolution.trace];
    }

    return {
        ...nextState,
        stackTrace: mergedTrace
    };
};
