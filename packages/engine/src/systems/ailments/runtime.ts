import type { Actor, AtomicEffect, GameState, Point, SimulationEvent, TimelineEvent } from '../../types';
import type { AilmentDefinition } from '../../data/ailments';
import { getAilmentDefinition, listAilmentDefinitions } from '../../data/ailments';
import type { AilmentID } from '../../types/registry';
import { hexEquals } from '../../hex';
import { extractTrinityStats } from '../combat/combat-calculator';
import { applyDamage } from '../entities/actor';
import { computeAilmentApplication } from './application';
import { resolveAilmentAnnihilation } from './annihilation';
import { gainAilmentResilienceXp, getAilmentBaseResistancePct, getAilmentSpecificResistancePct } from './hardening';
import { computeAilmentTick } from './tick';
import type { AilmentCountersComponent, AilmentProfileComponent, AilmentResilienceComponent } from '../components';
import type { AtomicEffectContext } from '../effects/types';

type AilmentSource = 'skill' | 'tile' | 'system';

export interface AilmentTickResultEnvelope {
    state: GameState;
    messages: string[];
}

const DEFAULT_VERSION = 'acae-v1' as const;

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });
const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const getSimulationEventId = (state: GameState, type: SimulationEvent['type']): string => {
    const idx = (state.simulationEvents || []).length;
    return `sim:${state.turnNumber || 0}:${idx}:${type}`;
};

const getTimelineEventId = (state: GameState, phase: TimelineEvent['phase'], context: AtomicEffectContext): string => {
    const idx = (state.timelineEvents || []).length;
    const turn = state.turnNumber || 0;
    const actorId = context.sourceId || context.targetId || 'system';
    const groupId = context.stepId || `${turn}:${actorId}`;
    return `${groupId}:${idx}:${phase}`;
};

const appendSimulationEvent = (
    state: GameState,
    event: Omit<SimulationEvent, 'id' | 'turn'>
): GameState => {
    const nextEvent: SimulationEvent = {
        ...event,
        id: getSimulationEventId(state, event.type),
        turn: state.turnNumber || 0
    };
    return {
        ...state,
        simulationEvents: [...(state.simulationEvents || []), nextEvent]
    };
};

const appendTimelineEvent = (
    state: GameState,
    phase: TimelineEvent['phase'],
    type: string,
    payload: Record<string, unknown>,
    context: AtomicEffectContext
): GameState => {
    const actorId = context.sourceId || context.targetId;
    const turn = state.turnNumber || 0;
    const groupId = context.stepId || `${turn}:${actorId || 'system'}`;
    const event: TimelineEvent = {
        id: getTimelineEventId(state, phase, context),
        turn,
        actorId,
        groupId,
        stepId: context.stepId || groupId,
        phase,
        type,
        payload,
        blocking: false,
        suggestedDurationMs: 0
    };
    return {
        ...state,
        timelineEvents: [...(state.timelineEvents || []), event]
    };
};

const isAilmentCountersComponent = (component: unknown): component is AilmentCountersComponent =>
    typeof component === 'object' && component !== null && (component as AilmentCountersComponent).type === 'ailments';

const isAilmentResilienceComponent = (component: unknown): component is AilmentResilienceComponent =>
    typeof component === 'object' && component !== null && (component as AilmentResilienceComponent).type === 'ailment_resilience';

const isAilmentProfileComponent = (component: unknown): component is AilmentProfileComponent =>
    typeof component === 'object' && component !== null && (component as AilmentProfileComponent).type === 'ailment_profile';

const resolveAilmentCountersComponent = (actor: Actor): AilmentCountersComponent => {
    const component = actor.components?.get('ailments');
    if (isAilmentCountersComponent(component)) return component;
    return { type: 'ailments', counters: {} };
};

const resolveAilmentResilienceComponent = (actor: Actor): AilmentResilienceComponent => {
    const component = actor.components?.get('ailment_resilience');
    if (isAilmentResilienceComponent(component)) return component;
    return { type: 'ailment_resilience', xp: {}, resistancePct: {} };
};

const resolveAilmentProfileComponent = (actor: Actor): AilmentProfileComponent => {
    const component = actor.components?.get('ailment_profile');
    if (isAilmentProfileComponent(component)) return component;
    return { type: 'ailment_profile', baseResistancePct: {}, resistanceGrowthRate: 1 };
};

const setActorAilmentComponents = (
    actor: Actor,
    counters: Partial<Record<AilmentID, number>>,
    resilience?: AilmentResilienceComponent,
    profile?: AilmentProfileComponent
): Actor => {
    const nextComponents = new Map(actor.components || []);
    const sanitizedCounters: Partial<Record<AilmentID, number>> = {};
    (Object.keys(counters) as AilmentID[]).forEach((id) => {
        const value = Math.max(0, Math.floor(counters[id] || 0));
        if (value > 0) sanitizedCounters[id] = value;
    });
    nextComponents.set('ailments', {
        type: 'ailments',
        counters: sanitizedCounters
    } as AilmentCountersComponent);
    nextComponents.set('ailment_resilience', resilience || resolveAilmentResilienceComponent(actor));
    nextComponents.set('ailment_profile', profile || resolveAilmentProfileComponent(actor));
    return {
        ...actor,
        components: nextComponents
    };
};

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
};

const resolveActorAt = (state: GameState, target: Point): Actor | undefined => {
    if (hexEquals(state.player.position, target)) return state.player;
    return state.enemies.find(e => hexEquals(e.position, target)) || state.companions?.find(e => hexEquals(e.position, target));
};

const updateActorById = (state: GameState, actorId: string, actor: Actor): GameState => {
    const nextPlayer = state.player.id === actorId ? actor : state.player;
    const nextEnemies = state.enemies.map(e => e.id === actorId ? actor : e);
    const nextCompanions = state.companions?.map(e => e.id === actorId ? actor : e);
    return {
        ...state,
        player: nextPlayer,
        enemies: nextEnemies,
        companions: nextCompanions
    };
};

const removeActorById = (state: GameState, actorId: string): GameState => {
    if (state.player.id === actorId) return state;
    return {
        ...state,
        enemies: state.enemies.filter(e => e.id !== actorId),
        companions: state.companions?.filter(e => e.id !== actorId)
    };
};

const resolveTargetActor = (
    state: GameState,
    target: 'targetActor' | Point | string,
    context: AtomicEffectContext
): { actorId: string; actor: Actor } | undefined => {
    if (typeof target === 'string') {
        if (target === 'targetActor') {
            if (!context.targetId) return undefined;
            const actor = resolveActorById(state, context.targetId);
            return actor ? { actorId: actor.id, actor } : undefined;
        }
        const actor = resolveActorById(state, target);
        return actor ? { actorId: actor.id, actor } : undefined;
    }
    const actor = resolveActorAt(state, target);
    return actor ? { actorId: actor.id, actor } : undefined;
};

const getCounter = (actor: Actor, ailment: AilmentID): number =>
    Math.max(0, Math.floor(resolveAilmentCountersComponent(actor).counters[ailment] || 0));

const getCounters = (actor: Actor): Partial<Record<AilmentID, number>> => ({ ...resolveAilmentCountersComponent(actor).counters });

const appendThresholdEvents = (
    state: GameState,
    actorId: string,
    definition: AilmentDefinition,
    before: number,
    after: number
): GameState => {
    let nextState = state;
    for (const threshold of definition.thresholds || []) {
        if (before < threshold.count && after >= threshold.count) {
            nextState = appendSimulationEvent(nextState, {
                type: 'AilmentThresholdTriggered',
                actorId,
                targetId: actorId,
                payload: {
                    ailment: definition.id,
                    threshold: threshold.count,
                    effectId: threshold.effectId,
                    message: threshold.message,
                    bonusDamage: threshold.bonusDamage || 0
                }
            });
        }
    }
    return nextState;
};

const applyHardeningGainForAilment = (
    state: GameState,
    actorId: string,
    ailment: AilmentID,
    xpDelta: number,
    source: 'tick' | 'shock'
): GameState => {
    if (xpDelta <= 0) return state;
    const definition = getAilmentDefinition(ailment);
    if (!definition) return state;
    const actor = resolveActorById(state, actorId);
    if (!actor) return state;
    const gain = gainAilmentResilienceXp(actor, ailment, xpDelta, definition);
    let nextState = updateActorById(state, actorId, gain.actor);
    if (gain.gainedPct > 0) {
        nextState = appendSimulationEvent(nextState, {
            type: 'AilmentResilienceGained',
            actorId,
            targetId: actorId,
            payload: {
                ailment,
                previousPct: gain.previousPct,
                nextPct: gain.nextPct,
                gainedPct: gain.gainedPct,
                source
            }
        });
    }
    return nextState;
};

export const isAcaeEnabled = (state: GameState): boolean =>
    state.ruleset?.ailments?.acaeEnabled === true;

export const resolveAcaeRuleset = (state: GameState): NonNullable<GameState['ruleset']> => {
    const defaultEnabled = typeof process !== 'undefined' && process.env?.HOP_ACAE_ENABLED === '1';
    return {
        ...(state.ruleset || {}),
        ailments: {
            acaeEnabled: state.ruleset?.ailments?.acaeEnabled ?? defaultEnabled,
            version: DEFAULT_VERSION
        }
    };
};

export const getActorAilmentCounters = (actor: Actor): Partial<Record<AilmentID, number>> => {
    return getCounters(actor);
};

export const getActorAilmentCounterSignature = (actor: Actor): string => {
    const counters = getActorAilmentCounters(actor);
    return (Object.keys(counters) as AilmentID[])
        .sort((a, b) => a.localeCompare(b))
        .map(id => `${id}:${Math.floor(counters[id] || 0)}`)
        .join('|');
};

export const applyAilmentToTarget = (
    state: GameState,
    target: 'targetActor' | Point | string,
    ailment: AilmentID,
    skillMultiplier: number,
    baseDeposit: number | undefined,
    context: AtomicEffectContext = {},
    source: AilmentSource = 'skill'
): GameState => {
    if (!isAcaeEnabled(state)) return state;
    const targetResolved = resolveTargetActor(state, target, context);
    if (!targetResolved) return state;
    const ailmentDefinition = getAilmentDefinition(ailment);
    if (!ailmentDefinition) return state;

    const sourceActor = context.sourceId ? resolveActorById(state, context.sourceId) : undefined;
    const actualSource = sourceActor || targetResolved.actor;
    const targetActor = targetResolved.actor;
    const resistanceBase = clampPercent(getAilmentBaseResistancePct(targetActor, ailment));
    const resistanceSpecific = clampPercent(getAilmentSpecificResistancePct(targetActor, ailment));
    const app = computeAilmentApplication(
        state,
        {
            ailment: ailmentDefinition,
            source: actualSource,
            target: targetActor,
            skillMultiplier: skillMultiplier + (ailmentDefinition.core.skillMultiplierBase || 0),
            baseDeposit: Math.max(0, baseDeposit ?? ailmentDefinition.core.baseDeposit)
        },
        resistanceBase,
        resistanceSpecific
    );

    let nextState = appendTimelineEvent(app.nextState, 'AILMENT_APPLY', 'ApplyAilment', {
        ailment,
        triggerValue: app.result.triggerValue,
        roll: app.result.roll,
        target: targetResolved.actorId,
        source
    }, context);

    if (!app.result.applied || app.result.depositAmount <= 0) {
        return appendSimulationEvent(nextState, {
            type: 'AilmentChanged',
            actorId: context.sourceId,
            targetId: targetResolved.actorId,
            payload: {
                ailment,
                applied: false,
                triggerValue: app.result.triggerValue,
                roll: app.result.roll,
                deposited: 0,
                source
            }
        });
    }

    nextState = depositAilmentCounters(
        nextState,
        targetResolved.actorId,
        ailment,
        app.result.depositAmount,
        context,
        source
    );
    return appendSimulationEvent(nextState, {
        type: 'AilmentChanged',
        actorId: context.sourceId,
        targetId: targetResolved.actorId,
        payload: {
            ailment,
            applied: true,
            triggerValue: app.result.triggerValue,
            roll: app.result.roll,
            deposited: app.result.depositAmount,
            source
        }
    });
};

export const depositAilmentCounters = (
    state: GameState,
    target: 'targetActor' | Point | string,
    ailment: AilmentID,
    amount: number,
    context: AtomicEffectContext = {},
    source: AilmentSource = 'system'
): GameState => {
    if (!isAcaeEnabled(state)) return state;
    const targetResolved = resolveTargetActor(state, target, context);
    if (!targetResolved) return state;
    const definition = getAilmentDefinition(ailment);
    if (!definition) return state;
    const incomingAmount = Math.max(0, Math.floor(amount));
    if (incomingAmount <= 0) return state;

    const beforeCounters = getCounters(targetResolved.actor);
    const beforeAilmentCount = Math.max(0, Math.floor(beforeCounters[ailment] || 0));
    const annihilation = resolveAilmentAnnihilation(definition, beforeCounters, incomingAmount);
    const afterAilmentCount = Math.max(0, Math.floor(annihilation.counters[ailment] || 0));

    let nextActor = setActorAilmentComponents(targetResolved.actor, annihilation.counters);
    let nextState = updateActorById(state, targetResolved.actorId, nextActor);
    nextState = appendTimelineEvent(nextState, 'AILMENT_ANNIHILATE', 'DepositAilmentCounters', {
        ailment,
        amount: incomingAmount,
        deposited: annihilation.deposited,
        source,
        target: targetResolved.actorId
    }, context);
    nextState = appendSimulationEvent(nextState, {
        type: 'AilmentChanged',
        actorId: context.sourceId,
        targetId: targetResolved.actorId,
        payload: {
            ailment,
            before: beforeAilmentCount,
            after: afterAilmentCount,
            delta: afterAilmentCount - beforeAilmentCount,
            source
        }
    });

    for (const delta of annihilation.deltas) {
        nextState = appendSimulationEvent(nextState, {
            type: 'AilmentAnnihilated',
            actorId: context.sourceId,
            targetId: targetResolved.actorId,
            payload: {
                incoming: delta.incoming,
                against: delta.against,
                incomingNeutralized: delta.incomingNeutralized,
                opposingConsumed: delta.opposingConsumed,
                ratio: delta.ratio
            }
        });
        if (delta.incomingNeutralized > 0) {
            nextState = applyHardeningGainForAilment(
                nextState,
                targetResolved.actorId,
                delta.incoming,
                delta.incomingNeutralized * definition.hardening.shockXpRate,
                'shock'
            );
        }
        if (delta.opposingConsumed > 0) {
            const opposingDef = getAilmentDefinition(delta.against);
            if (opposingDef) {
                nextState = applyHardeningGainForAilment(
                    nextState,
                    targetResolved.actorId,
                    delta.against,
                    delta.opposingConsumed * opposingDef.hardening.shockXpRate,
                    'shock'
                );
            }
        }
    }

    const refreshedActor = resolveActorById(nextState, targetResolved.actorId);
    if (refreshedActor) {
        const refreshedCount = getCounter(refreshedActor, ailment);
        nextState = appendThresholdEvents(nextState, targetResolved.actorId, definition, beforeAilmentCount, refreshedCount);
    }
    return nextState;
};

export const clearAilmentCounters = (
    state: GameState,
    target: 'targetActor' | Point | string,
    ailment: AilmentID | undefined,
    amount: number | undefined,
    reason: string | undefined,
    context: AtomicEffectContext = {}
): GameState => {
    if (!isAcaeEnabled(state)) return state;
    const targetResolved = resolveTargetActor(state, target, context);
    if (!targetResolved) return state;

    const before = getCounters(targetResolved.actor);
    const nextCounters = { ...before };
    const changedIds: AilmentID[] = [];

    if (!ailment) {
        (Object.keys(nextCounters) as AilmentID[]).forEach(id => {
            if ((nextCounters[id] || 0) > 0) {
                changedIds.push(id);
                delete nextCounters[id];
            }
        });
    } else {
        const prev = Math.max(0, Math.floor(nextCounters[ailment] || 0));
        const clearAmount = amount === undefined ? prev : Math.max(0, Math.floor(amount));
        const after = Math.max(0, prev - clearAmount);
        if (after !== prev) changedIds.push(ailment);
        if (after > 0) nextCounters[ailment] = after;
        else delete nextCounters[ailment];
    }

    if (changedIds.length === 0) return state;

    const nextActor = setActorAilmentComponents(targetResolved.actor, nextCounters);
    let nextState = updateActorById(state, targetResolved.actorId, nextActor);

    for (const id of changedIds) {
        const prev = Math.max(0, Math.floor(before[id] || 0));
        const after = Math.max(0, Math.floor(nextCounters[id] || 0));
        nextState = appendSimulationEvent(nextState, {
            type: 'AilmentChanged',
            actorId: context.sourceId,
            targetId: targetResolved.actorId,
            payload: {
                ailment: id,
                before: prev,
                after,
                delta: after - prev,
                reason: reason || 'clear'
            }
        });
    }
    return nextState;
};

const applyAilmentTickDamage = (
    state: GameState,
    actorId: string,
    ailment: AilmentID,
    amount: number,
    context: AtomicEffectContext
): GameState => {
    if (amount <= 0) return state;
    const actor = resolveActorById(state, actorId);
    if (!actor) return state;
    const damaged = applyDamage(actor, amount);
    let nextState = updateActorById(state, actorId, damaged);
    nextState = appendSimulationEvent(nextState, {
        type: 'DamageTaken',
        actorId: context.sourceId,
        targetId: actorId,
        position: clonePoint(damaged.position),
        payload: {
            amount,
            reason: `acae_${ailment}_tick`,
            sourceId: context.sourceId
        }
    });
    if (damaged.hp <= 0 && actorId !== nextState.player.id) {
        nextState = removeActorById(nextState, actorId);
    }
    return nextState;
};

export const tickActorAilments = (
    state: GameState,
    actorId: string,
    window: 'START_OF_TURN' | 'END_OF_TURN',
    stepId?: string
): AilmentTickResultEnvelope => {
    if (!isAcaeEnabled(state)) return { state, messages: [] };
    const actor = resolveActorById(state, actorId);
    if (!actor) return { state, messages: [] };

    let nextState = state;
    const messages: string[] = [];
    const context: AtomicEffectContext = { sourceId: actorId, targetId: actorId, stepId };
    const definitions = listAilmentDefinitions();

    for (const definition of definitions) {
        const currentActor = resolveActorById(nextState, actorId);
        if (!currentActor) break;
        const counters = getCounter(currentActor, definition.id);
        if (counters <= 0) continue;

        const trinity = extractTrinityStats(currentActor);
        const resiliencePct = getAilmentSpecificResistancePct(currentActor, definition.id);
        const tick = computeAilmentTick({
            definition,
            counters,
            formulaContext: {
                currentCounters: counters,
                resiliencePct,
                maxHp: currentActor.maxHp,
                body: trinity.body,
                mind: trinity.mind,
                instinct: trinity.instinct
            }
        });

        nextState = appendTimelineEvent(nextState, 'AILMENT_TICK', 'AilmentTick', {
            ailment: definition.id,
            actorId,
            window,
            counters,
            damage: tick.damage,
            decay: tick.decay
        }, context);

        nextState = applyAilmentTickDamage(nextState, actorId, definition.id, tick.damage, context);
        nextState = clearAilmentCounters(
            nextState,
            actorId,
            definition.id,
            tick.decay,
            'tick_decay',
            context
        );

        const actorAfterTick = resolveActorById(nextState, actorId);
        if (!actorAfterTick) break;
        const tickXpDelta = counters * Math.max(0, definition.hardening.tickXpRate);
        nextState = applyHardeningGainForAilment(nextState, actorId, definition.id, tickXpDelta, 'tick');

        const threshold = (definition.thresholds || [])
            .filter(th => getCounter(actorAfterTick, definition.id) >= th.count)
            .sort((a, b) => b.count - a.count)[0];
        if (threshold?.message) {
            messages.push(threshold.message);
        }
    }

    return { state: nextState, messages };
};

export const buildAilmentDeltaSummary = (events: SimulationEvent[]): string[] => {
    const deltasByAilment = new Map<AilmentID, number>();
    for (const ev of events) {
        if (ev.type !== 'AilmentChanged') continue;
        const ailment = ev.payload?.ailment as AilmentID | undefined;
        const delta = Number(ev.payload?.delta || 0);
        if (!ailment || !Number.isFinite(delta) || delta === 0) continue;
        deltasByAilment.set(ailment, (deltasByAilment.get(ailment) || 0) + delta);
    }
    return Array.from(deltasByAilment.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, delta]) => `${delta > 0 ? '+' : ''}${delta} ${id.charAt(0).toUpperCase()}${id.slice(1)}`);
};

export const getAcaePilotAilments = (): AilmentID[] => ['burn', 'wet', 'poison', 'frozen', 'bleed'];

const createAilmentEffectsIfEnabled = (
    state: GameState,
    targetId: string,
    ailment: AilmentID,
    amount: number,
    source: AilmentSource
): AtomicEffect[] => {
    if (!isAcaeEnabled(state)) return [];
    if (amount <= 0) return [];
    return [{
        type: 'DepositAilmentCounters',
        target: targetId,
        ailment,
        amount: Math.max(0, Math.floor(amount)),
        source
    }];
};

export const createTileAilmentInjectionEffects = (
    state: GameState,
    actor: Actor,
    tileKind: 'lava' | 'fire' | 'wet' | 'miasma' | 'ice',
    intensity: 'pass' | 'enter' | 'stay'
): AtomicEffect[] => {
    if (!isAcaeEnabled(state)) return [];
    const amountTable: Record<typeof tileKind, Record<typeof intensity, number>> = {
        lava: { pass: 8, enter: 14, stay: 10 },
        fire: { pass: 4, enter: 6, stay: 5 },
        wet: { pass: 3, enter: 5, stay: 4 },
        miasma: { pass: 4, enter: 7, stay: 6 },
        ice: { pass: 2, enter: 4, stay: 3 }
    };
    const ailmentByTile: Record<typeof tileKind, AilmentID> = {
        lava: 'burn',
        fire: 'burn',
        wet: 'wet',
        miasma: 'poison',
        ice: 'frozen'
    };
    return createAilmentEffectsIfEnabled(
        state,
        actor.id,
        ailmentByTile[tileKind],
        amountTable[tileKind][intensity],
        'tile'
    );
};

