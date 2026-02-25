import type { GameState, AtomicEffect, Actor, Point, MovementTrace, TimelineEvent, TimelinePhase, StackResolutionTick, SimulationEvent } from '../types';
import { hexEquals, getHexLine, getDirectionFromTo, hexDirection, hexAdd } from '../hex';
import { applyDamage, applyHeal, checkVitals, addStatus } from './actor';

import { addToQueue } from './initiative';
import { TileResolver } from './tile-effects';
import { pointToKey } from '../hex';
import { BASE_TILES } from './tile-registry';
import { UnifiedTileService } from './unified-tile-service';
import { SpatialSystem } from './SpatialSystem';
import { stableIdFromSeed } from './rng';
import { createEntity, ensureActorTrinity } from './entity-factory';
import { computeStatusDuration, extractTrinityStats } from './combat-calculator';
import { getIncomingDamageMultiplier, getOutgoingDamageMultiplier } from './combat-traits';
import { appendTaggedMessage, appendTaggedMessages, tagMessage } from './engine-messages';
import { resolveLifoStack } from './resolution-stack';
import { appendJuiceSignature, buildJuiceSequenceId, getHexEdgeContactWorld, getLegacyJuiceSignatureTemplate } from './juice-signature';

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
    context: { targetId?: string; sourceId?: string; stepId?: string },
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
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: { targetId?: string; sourceId?: string; stepId?: string } = {}): GameState => {
    let nextState = { ...state };
    const ensureTilesClone = () => {
        if (nextState.tiles === state.tiles) {
            nextState = { ...nextState, tiles: new Map(nextState.tiles) };
        }
    };

    switch (effect.type) {
        case 'Displacement': {
            let targetActorId = '';
            if (effect.target === 'self') targetActorId = context.sourceId || nextState.player.id;
            else if (effect.target === 'targetActor') targetActorId = context.targetId || '';
            else targetActorId = effect.target; // Literal ID

            if (!targetActorId) break;

            const resolveActor = (s: GameState, actorId: string): Actor | undefined => {
                if (actorId === s.player.id) return s.player;
                return s.enemies.find(e => e.id === actorId);
            };

            const actor = resolveActor(nextState, targetActorId);
            if (!actor) {
                // Target actor may have been removed earlier in the same effect chain.
                // Skip displacement safely instead of crashing path simulation.
                break;
            }

            const origin = effect.source || actor?.position;
            // Critical sequencing contract:
            // movement traces should begin after all prior blocking timeline beats.
            // This allows UI playback to remain actor-by-actor, even if engine logic resolves instantly.
            const timelineDelayBeforeMoveMs = Math.min(
                3200,
                Math.max(0, getBlockingTimelineDurationMs(nextState.timelineEvents))
            );
            let moveEndedEventEmitted = false;
            const isTeleportMovement = !((effect as any).simulatePath || effect.path || effect.isFling);
            if (origin) {
                nextState = appendTimelineEvent(
                    nextState,
                    'MOVE_START',
                    'Displacement',
                    { origin, destination: effect.destination, targetActorId },
                    { ...context, targetId: targetActorId },
                    true,
                    220
                );
            }

            if (origin) {
                const path = effect.path || (origin ? getHexLine(origin, effect.destination) : undefined);
                // Simulate if explicitly requested, if it's a fling, or if a path was already provided
                const shouldSimulate = (effect as any).simulatePath || effect.isFling || !!effect.path;

                let finalDestination = effect.destination;

                if (shouldSimulate && path) {
                    const liveActor = resolveActor(nextState, targetActorId);
                    if (!liveActor) {
                        break;
                    }
                    // Unified Spatial Logic: All displacements now respect tile-based momentum/hazards!
                    // We pass path.length - 1 as the "intrinsic momentum" of the displacement to ensure it finishes exactly at destination unless slippery.
                    const pathResult = TileResolver.processPath(liveActor, path.slice(1), nextState, path.length - 1, {
                        ignoreActors: (effect as any).ignoreCollision,
                        ignoreGroundHazards: effect.ignoreGroundHazards
                    });
                    finalDestination = pathResult.lastValidPos;

                    // INTERMEDIATE POSITION UPDATE:
                    // Ensure actor is at the hazard tile before applying effects (like Damage)
                    // so that if they die, the corpse/dyingEntity has the correct location.
                    if (targetActorId === nextState.player.id) {
                        nextState.player = { ...nextState.player, position: finalDestination };
                    } else {
                        nextState.enemies = nextState.enemies.map(e => e.id === targetActorId ? { ...e, position: finalDestination } : e);
                    }

                    // Handle side-effects (Damage, Stun, etc.) from the environment
                    if (!moveEndedEventEmitted) {
                        nextState = appendTimelineEvent(
                            nextState,
                            'MOVE_END',
                            'Displacement',
                            { destination: finalDestination, targetActorId },
                            { ...context, targetId: targetActorId },
                            true,
                            260
                        );
                        moveEndedEventEmitted = true;
                    }
                    if (pathResult.result.effects.length > 0) {
                        nextState = appendTimelineEvent(
                            nextState,
                            'ON_PASS',
                            'TilePath',
                            { path: path.slice(1), targetActorId },
                            { ...context, targetId: targetActorId },
                            false,
                            80
                        );
                        nextState = applyEffects(nextState, pathResult.result.effects, { targetId: targetActorId });
                    }
                    if (pathResult.result.messages.length > 0) {
                        nextState.message = appendTaggedMessages(nextState.message, pathResult.result.messages, 'INFO', 'HAZARD');
                    }

                    // Process Entry for the final destination (if we didn't die/interrupt mid-path)
                    // We check if actor still exists in enemies (or is player) to ensure they are alive
                    const isAlive = (targetActorId === nextState.player.id) || nextState.enemies.some(e => e.id === targetActorId);

                    if (!pathResult.interrupt && isAlive) {
                        const finalTile = UnifiedTileService.getTileAt(nextState, finalDestination);
                        nextState = appendTimelineEvent(
                            nextState,
                            'ON_ENTER',
                            'TileEnter',
                            { position: finalDestination, targetActorId, tileBaseId: finalTile?.baseId },
                            { ...context, targetId: targetActorId },
                            false,
                            80
                        );
                        const liveActorForEntry = resolveActor(nextState, targetActorId);
                        if (!liveActorForEntry) {
                            break;
                        }
                        const entryResult = TileResolver.processEntry(liveActorForEntry, finalTile, nextState);
                        if (entryResult.effects.length > 0) {
                            nextState = applyEffects(nextState, entryResult.effects, { targetId: targetActorId });
                        }
                        if (entryResult.messages.length > 0) {
                            nextState.message = appendTaggedMessages(nextState.message, entryResult.messages, 'INFO', 'HAZARD');
                        }
                    }

                    // Handle SLIPPERY extension (Sliding)
                    if (pathResult.result.newMomentum && pathResult.result.newMomentum > 0) {
                        // Project in same direction
                        const lastPos = pathResult.lastValidPos;
                        const prevPos = path.length > 1 ? path[path.length - 2] : origin;
                        const dirIdx = getDirectionFromTo(prevPos, lastPos);

                        if (dirIdx !== -1) {
                            const dirVec = hexDirection(dirIdx);
                            let slidePos = lastPos;
                            let remaining = 5; // Safety cap for slide distance

                            while (remaining > 0) {
                                const nextSlide = hexAdd(slidePos, dirVec);
                                if (!UnifiedTileService.isWalkable(nextState, nextSlide)) break;

                                // NEW: Slide collision (Actors)
                                const occupant = (targetActorId === nextState.player.id)
                                    ? nextState.enemies.find(e => e.hp > 0 && hexEquals(e.position, nextSlide))
                                    : (hexEquals(nextState.player.position, nextSlide) ? nextState.player : nextState.enemies.find(e => e.id !== targetActorId && e.hp > 0 && hexEquals(e.position, nextSlide)));

                                if (occupant) break;

                                const tile = UnifiedTileService.getTileAt(nextState, nextSlide);
                                if (tile) {
                                    const transition = TileResolver.processTransition(actor as Actor, tile, nextState, 1);
                                    slidePos = nextSlide;
                                    // Apply side effects during slide too
                                    if (transition.effects.length > 0) {
                                        nextState = applyEffects(nextState, transition.effects, { targetId: targetActorId });
                                    }
                                    if (transition.messages.length > 0) {
                                        nextState.message = appendTaggedMessages(nextState.message, transition.messages, 'INFO', 'HAZARD');
                                    }
                                    if (transition.newMomentum === 0 || transition.interrupt) break;
                                } else {
                                    slidePos = nextSlide;
                                    break; // No tile data, stop sliding
                                }
                                remaining--;
                            }
                            finalDestination = slidePos;
                        }
                    }
                }

                const existingVisualEvents = [...(nextState.visualEvents || [])];
                const isKineticTransfer = Boolean((effect as any).ignoreCollision || effect.isFling);
                const priorKineticSlides = isKineticTransfer
                    ? existingVisualEvents.reduce((count, ev) => {
                        if (ev.type !== 'kinetic_trace') return count;
                        const payload = ev.payload as MovementTrace | undefined;
                        if (!payload) return count;
                        return (payload.movementType ?? 'slide') === 'slide' ? count + 1 : count;
                    }, 0)
                    : 0;
                const kineticChainDelayMs = isTeleportMovement
                    ? 0
                    : (isKineticTransfer ? Math.min(640, priorKineticSlides * 90) : 0);
                const traceStartDelayMs = Math.max(timelineDelayBeforeMoveMs, kineticChainDelayMs);

                const trace: MovementTrace = {
                    actorId: targetActorId,
                    origin,
                    path: effect.path || (isTeleportMovement ? [origin, finalDestination] : getHexLine(origin, finalDestination)),
                    destination: finalDestination,
                    movementType: isTeleportMovement ? 'teleport' : 'slide',
                    durationMs: effect.animationDuration ?? (isTeleportMovement ? 180 : Math.max(120, (effect.path?.length || getHexLine(origin, finalDestination).length) * 110)),
                    startDelayMs: traceStartDelayMs,
                    wasLethal: nextState.tiles.get(pointToKey(finalDestination))?.traits.has('HAZARDOUS') || false
                };

                // Coalesce chained slide traces for the same actor into one continuous path.
                // This preserves step-by-step slide playback for kinetic pulses that emit
                // multiple Displacement effects in a single resolution pass.
                const visualEvents = existingVisualEvents;
                if (!isTeleportMovement) {
                    let merged = false;
                    for (let i = visualEvents.length - 1; i >= 0; i--) {
                        const ev = visualEvents[i];
                        if (ev.type !== 'kinetic_trace') continue;
                        const prev = ev.payload as MovementTrace | undefined;
                        if (!prev || prev.actorId !== targetActorId) continue;

                        if ((prev.movementType ?? 'slide') === 'slide' && hexEquals(prev.destination, trace.origin)) {
                            const prevPath = (prev.path && prev.path.length > 0) ? prev.path : [prev.origin, prev.destination];
                            const nextPath = (trace.path && trace.path.length > 0) ? trace.path : [trace.origin, trace.destination];
                            const mergedPath = [...prevPath, ...nextPath.slice(1)];
                            visualEvents[i] = {
                                type: 'kinetic_trace' as const,
                                payload: {
                                    ...trace,
                                    origin: prev.origin,
                                    path: mergedPath,
                                    durationMs: (prev.durationMs || 0) + (trace.durationMs || 0),
                                    startDelayMs: Math.min(prev.startDelayMs ?? traceStartDelayMs, traceStartDelayMs),
                                    movementType: 'slide' as const,
                                    wasLethal: Boolean(prev.wasLethal || trace.wasLethal),
                                } as MovementTrace
                            };
                            merged = true;
                        }
                        break;
                    }
                    if (!merged) {
                        visualEvents.push({
                            type: 'kinetic_trace' as const,
                            payload: trace
                        });
                    }
                } else {
                    visualEvents.push({
                        type: 'kinetic_trace' as const,
                        payload: trace
                    });
                }
                nextState.visualEvents = visualEvents;

                if (targetActorId === nextState.player.id) {
                    nextState.player = {
                        ...nextState.player,
                        position: finalDestination,
                        previousPosition: isTeleportMovement ? finalDestination : nextState.player.position
                    };
                } else {
                    const updatePos = (e: Actor) => e.id === targetActorId
                        ? { ...e, position: finalDestination, previousPosition: isTeleportMovement ? finalDestination : e.position }
                        : e;
                    nextState.enemies = nextState.enemies.map(updatePos);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updatePos);
                    }
                }

                // WORLD-CLASS LOGIC: Spatial Synchronization
                // Displacement changes unit positions; we MUST refresh the bitmask so the AI/Validation 
                // sees the new reality immediately within the same turn if multiple effects occur.
                nextState.occupancyMask = SpatialSystem.refreshOccupancyMask(nextState);
                if (!moveEndedEventEmitted) {
                    nextState = appendTimelineEvent(
                        nextState,
                        'MOVE_END',
                        'Displacement',
                        { destination: finalDestination, targetActorId },
                        { ...context, targetId: targetActorId },
                        true,
                        260
                    );
                }

                nextState = appendSimulationEvent(nextState, {
                    type: 'UnitMoved',
                    actorId: targetActorId,
                    position: finalDestination,
                    payload: {
                        origin,
                        destination: finalDestination,
                        movementType: trace.movementType
                    }
                });
            }
            break;
        }

        case 'Damage': {
            const isHazardReason = !!effect.reason && ['lava_sink', 'void_sink', 'hazard_intercept', 'lava_tick', 'fire_damage'].includes(effect.reason);
            const markedPredatorBonus = (victim?: Actor): number =>
                victim?.statusEffects?.some(s => s.type === 'marked_predator') ? 1 : 0;
            if (isHazardReason) {
                nextState = appendTimelineEvent(
                    nextState,
                    'HAZARD_CHECK',
                    'Damage',
                    { reason: effect.reason, amount: effect.amount, target: effect.target },
                    context,
                    true,
                    200
                );
            }
            nextState = appendTimelineEvent(
                nextState,
                'DAMAGE_APPLY',
                'Damage',
                { reason: effect.reason, amount: effect.amount, target: effect.target, scoreEvent: effect.scoreEvent },
                context,
                true,
                180
            );
            let targetActorId = '';
            let targetPos: Point | null = null;
            let simulationTargetId: string | undefined;
            let simulationPos: Point | undefined;
            let simulationAmount = effect.amount;

            if (typeof effect.target === 'string') {
                if (effect.target === 'targetActor') targetActorId = context.targetId || '';
                else if (effect.target !== 'area') targetActorId = effect.target; // Literal ID
            } else {
                targetPos = effect.target as Point;
            }

            // ABSORB_FIRE Logic: Intercept Fire Damage
            const fireReasons = ['fire_damage', 'lava_sink', 'burning', 'hazard_intercept', 'lava_tick', 'oil_explosion', 'void_sink'];
            const isFireDamage = effect.reason && fireReasons.includes(effect.reason);
            const hasEmberWard = nextState.upgrades?.includes('RELIC_EMBER_WARD');
            const hasCinderOrb = nextState.upgrades?.includes('RELIC_CINDER_ORB');

            if (isFireDamage && targetActorId) {
                const victim = targetActorId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetActorId);
                const hasAbsorb = victim?.activeSkills?.some(s => s.id === 'ABSORB_FIRE');
                let adjustedAmount = effect.amount;

                if (targetActorId === nextState.player.id && hasEmberWard) {
                    adjustedAmount = Math.max(0, adjustedAmount - 1);
                    nextState.message = appendTaggedMessage(nextState.message, 'Ember Ward dampens the flames.', 'INFO', 'COMBAT');
                }

                if (hasAbsorb) {
                    const healAmount = adjustedAmount + (targetActorId === nextState.player.id && hasCinderOrb ? 1 : 0);
                    if (targetActorId === nextState.player.id && hasCinderOrb) {
                        nextState.message = appendTaggedMessage(nextState.message, 'Cinder Orb amplifies the absorption.', 'INFO', 'COMBAT');
                    }
                    // Convert to Heal
                    return applyAtomicEffect(nextState, {
                        type: 'Heal',
                        target: targetActorId,
                        amount: healAmount
                    });
                }
            }

            if (targetActorId) {
                if (targetActorId === nextState.player.id) {
                    const victim = nextState.player;
                    const damageClass = effect.scoreEvent?.damageClass || 'physical';
                    const traitScaled = scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, victim, damageClass, effect.reason);
                    let damageAmount = traitScaled.amount;
                    damageAmount += markedPredatorBonus(victim);
                    if (isFireDamage && hasEmberWard) {
                        damageAmount = Math.max(0, damageAmount - 1);
                    }
                    if (effect.scoreEvent) {
                        nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), {
                            ...effect.scoreEvent,
                            finalPower: damageAmount,
                            traitOutgoingMultiplier: traitScaled.outgoing,
                            traitIncomingMultiplier: traitScaled.incoming,
                            traitTotalMultiplier: traitScaled.total
                        }].slice(-500);
                    }
                    nextState.player = applyDamage(nextState.player, damageAmount);
                    simulationTargetId = nextState.player.id;
                    simulationPos = nextState.player.position;
                    simulationAmount = damageAmount;
                    if (isFireDamage) {
                        nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                    }
                    if (isFireDamage && hasCinderOrb) {
                        nextState.player = applyHeal(nextState.player, 1);
                        nextState.message = appendTaggedMessage(nextState.message, 'Cinder Orb restores 1 HP.', 'INFO', 'COMBAT');
                    }
                } else {
                    const victim = nextState.enemies.find(e => e.id === targetActorId);
                    const victimPos = targetActorId === nextState.player.id ? nextState.player.position : victim?.position;
                    const corpsePositions: Point[] = [];
                    const damageClass = effect.scoreEvent?.damageClass || 'physical';
                    const traitScaled = scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, victim, damageClass, effect.reason);
                    const scaledAmount = traitScaled.amount + markedPredatorBonus(victim);
                    simulationTargetId = targetActorId || victim?.id;
                    simulationPos = victimPos || victim?.position;
                    simulationAmount = scaledAmount;

                    const updateDamage = (e: Actor) => {
                        if (e.id === targetActorId) {
                            const updated = applyDamage(e, scaledAmount);
                            if (updated.hp <= 0) {
                                nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                                corpsePositions.push(e.position);
                            }
                            return updated;
                        }
                        return e;
                    };
                    if (effect.scoreEvent) {
                        nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), {
                            ...effect.scoreEvent,
                            finalPower: scaledAmount,
                            traitOutgoingMultiplier: traitScaled.outgoing,
                            traitIncomingMultiplier: traitScaled.incoming,
                            traitTotalMultiplier: traitScaled.total
                        }].slice(-500);
                    }
                    nextState.enemies = nextState.enemies.map(updateDamage).filter((e: Actor) => e.hp > 0);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateDamage).filter((e: Actor) => e.hp > 0);
                    }
                    if (corpsePositions.length > 0) {
                        nextState = appendTimelineEvent(
                            nextState,
                            'DEATH_RESOLVE',
                            'Damage',
                            { targetActorId, reason: effect.reason || 'damage' },
                            { ...context, targetId: targetActorId },
                            true,
                            260
                        );
                    }
                    corpsePositions.forEach(pos => {
                        nextState = addCorpseTraitAt(nextState, pos);
                    });

                    if (victimPos) {
                        nextState.visualEvents = [...(nextState.visualEvents || []),
                        { type: 'vfx', payload: { type: 'impact', position: victimPos } }
                        ];
                    }

                    // Stealth Decay: Taking damage reduces stealth
                    if (targetActorId === nextState.player.id && (nextState.player.stealthCounter || 0) > 0) {
                        nextState.player = { ...nextState.player, stealthCounter: Math.max(0, (nextState.player.stealthCounter || 0) - 1) };
                    } else if (targetActorId !== nextState.player.id) {
                        const updateStealth = (e: Actor) => e.id === targetActorId ? { ...e, stealthCounter: Math.max(0, (e.stealthCounter || 0) - 1) } : e;
                        nextState.enemies = nextState.enemies.map(updateStealth);
                        if (nextState.companions) {
                            nextState.companions = nextState.companions.map(updateStealth);
                        }
                    }

                    // Hunter Passive (Player): Swift Roll away from attacker
                    if (targetActorId === nextState.player.id && nextState.player.archetype === 'HUNTER' && (effect as any).source) {
                        const rollDirIdx = getDirectionFromTo((effect as any).source, nextState.player.position);
                        if (rollDirIdx !== -1) {
                            nextState.message = appendTaggedMessage(nextState.message, 'You roll away!', 'INFO', 'COMBAT');
                        }
                    }

                    // Hunter Passive (Enemy): Swift Roll away from attacker
                    if (victim && victim.archetype === 'HUNTER' && (effect as any).source) {
                        const rollDirIdx = getDirectionFromTo((effect as any).source, victim.position);
                        if (rollDirIdx !== -1) {
                            nextState.message = appendTaggedMessage(nextState.message, `${victim.subtype || victim.id} rolls away!`, 'INFO', 'COMBAT');
                        }
                    }
                }
            } else if (targetPos) {
                const targetAtPos = resolveActorAt(nextState, targetPos);
                const damageClass = effect.scoreEvent?.damageClass || 'physical';
                const traitScaled = scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, targetAtPos, damageClass, effect.reason);
                const scaledAmount = traitScaled.amount;
                simulationTargetId = targetAtPos?.id;
                simulationPos = targetPos;
                simulationAmount = scaledAmount + markedPredatorBonus(targetAtPos || undefined);
                nextState.visualEvents = [...(nextState.visualEvents || []),
                { type: 'vfx', payload: { type: 'impact', position: targetPos } }
                ];
                if (effect.scoreEvent && targetAtPos) {
                    nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), {
                        ...effect.scoreEvent,
                        targetId: targetAtPos.id,
                        finalPower: scaledAmount,
                        traitOutgoingMultiplier: traitScaled.outgoing,
                        traitIncomingMultiplier: traitScaled.incoming,
                        traitTotalMultiplier: traitScaled.total
                    }].slice(-500);
                }
                if (hexEquals(nextState.player.position, targetPos)) {
                    nextState.player = applyDamage(nextState.player, scaledAmount + markedPredatorBonus(nextState.player));
                    if (isFireDamage) {
                        nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                    }
                    if (nextState.player.hp <= 0) {
                        // Game over handled by vitals check
                    }
                }
                const updateDamageAt = (e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        const updated = applyDamage(e, scaledAmount + markedPredatorBonus(e));
                        if (updated.hp <= 0) {
                            nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                            killedAtIds.push(e.id);
                            killedAtPositions.push(e.position);
                        }
                        return updated;
                    }
                    return e;
                };
                const killedAtPositions: Point[] = [];
                const killedAtIds: string[] = [];
                nextState.enemies = nextState.enemies.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
                if (nextState.companions) {
                    nextState.companions = nextState.companions.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
                }
                killedAtIds.forEach(deadId => {
                    nextState = appendTimelineEvent(
                        nextState,
                        'DEATH_RESOLVE',
                        'Damage',
                        { targetActorId: deadId, reason: effect.reason || 'area_damage' },
                        { ...context, targetId: deadId },
                        true,
                        260
                    );
                });
                killedAtPositions.forEach(pos => {
                    nextState = addCorpseTraitAt(nextState, pos);
                });
            }

            if (simulationAmount > 0) {
                nextState = appendSimulationEvent(nextState, {
                    type: 'DamageTaken',
                    targetId: simulationTargetId || targetActorId || undefined,
                    position: simulationPos,
                    payload: {
                        amount: simulationAmount,
                        reason: effect.reason,
                        sourceId: context.sourceId
                    }
                });
            }
            break;
        }

        case 'Heal': {
            const healActor = (actor: Actor): Actor => ({ ...actor, hp: Math.min(actor.maxHp, actor.hp + effect.amount) });
            const targetId = effect.target === 'targetActor' ? context.targetId : effect.target;
            let healedTargetId: string | undefined;
            let healedPos: Point | undefined;

            if (targetId) {
                const victim = targetId === nextState.player.id ? nextState.player : (nextState.enemies.find(e => e.id === targetId) || nextState.companions?.find(e => e.id === targetId));
                if (victim) {
                    const name = targetId === nextState.player.id ? 'You' : (victim.subtype || victim.id);
                    nextState.message = appendTaggedMessage(nextState.message, `${name} recover ${effect.amount} HP.`, 'INFO', 'COMBAT');

                    if (targetId === nextState.player.id) {
                        nextState.player = healActor(nextState.player);
                        healedTargetId = nextState.player.id;
                        healedPos = nextState.player.position;
                    } else {
                        const updateHeal = (e: Actor) => e.id === targetId ? healActor(e) : e;
                        nextState.enemies = nextState.enemies.map(updateHeal);
                        if (nextState.companions) {
                            nextState.companions = nextState.companions.map(updateHeal);
                        }
                        healedTargetId = victim.id;
                        healedPos = victim.position;
                    }
                }
            }
            if (healedTargetId) {
                nextState = appendSimulationEvent(nextState, {
                    type: 'Healed',
                    targetId: healedTargetId,
                    position: healedPos,
                    payload: { amount: effect.amount, sourceId: context.sourceId }
                });
            }
            break;
        }

        case 'ApplyStatus': {
            nextState = appendTimelineEvent(
                nextState,
                'STATUS_APPLY',
                'ApplyStatus',
                { status: effect.status, duration: effect.duration, target: effect.target },
                context,
                true,
                160
            );
            let targetActorId = '';
            let targetPos: Point | null = null;
            if (typeof effect.target === 'string') {
                if (effect.target === 'targetActor') targetActorId = context.targetId || '';
                else targetActorId = effect.target; // Literal ID
            } else {
                targetPos = effect.target as Point;
            }

            let resolvedPos = targetPos;

            const sourceActor = context.sourceId
                ? (context.sourceId === nextState.player.id
                    ? nextState.player
                    : nextState.enemies.find(e => e.id === context.sourceId))
                : undefined;
            const adjustedDuration = sourceActor
                ? computeStatusDuration(effect.duration, extractTrinityStats(sourceActor))
                : effect.duration;

            if (targetActorId) {
                const targetActor = targetActorId === nextState.player.id
                    ? nextState.player
                    : (nextState.enemies.find(e => e.id === targetActorId) || nextState.companions?.find(e => e.id === targetActorId));

                if (targetActor) {
                    resolvedPos = targetActor.position;
                    const name = targetActorId === nextState.player.id
                        ? 'You'
                        : `${targetActor.subtype || 'enemy'}#${targetActor.id}`;
                    const suffix = targetActorId === nextState.player.id ? 'are' : 'is';
                    nextState.message = appendTaggedMessage(nextState.message, `${name} ${suffix} ${effect.status}!`, 'INFO', 'COMBAT');

                    if (targetActorId === nextState.player.id) {
                        nextState.player = addStatus(nextState.player, effect.status as any, adjustedDuration);
                    } else {
                        const updateStatus = (e: Actor) => (e.id === targetActorId) ? addStatus(e, effect.status as any, adjustedDuration) : e;
                        nextState.enemies = nextState.enemies.map(updateStatus);
                        if (nextState.companions) {
                            nextState.companions = nextState.companions.map(updateStatus);
                        }
                    }
                }
            }

            if (effect.status === 'stunned' && resolvedPos) {
                nextState.visualEvents = [...(nextState.visualEvents || []),
                { type: 'shake', payload: { intensity: 'low' } },
                { type: 'vfx', payload: { type: 'stunBurst', position: resolvedPos } },
                { type: 'combat_text', payload: { text: 'STUNNED', position: resolvedPos } }
                ];
            }
            const resolvedTargetId = targetActorId || (resolvedPos ? resolveActorAt(nextState, resolvedPos)?.id : undefined);
            nextState = appendSimulationEvent(nextState, {
                type: 'StatusApplied',
                targetId: resolvedTargetId,
                position: resolvedPos || undefined,
                payload: {
                    status: effect.status,
                    duration: adjustedDuration,
                    sourceId: context.sourceId
                }
            });
            break;
        }

        case 'PickupShield': {
            const pickupPos = effect.position || nextState.shieldPosition;
            if (pickupPos && nextState.shieldPosition && hexEquals(nextState.shieldPosition, pickupPos)) {
                nextState.hasShield = true;
                nextState.shieldPosition = undefined;

                const bulwarkSkill: any = {
                    id: 'BULWARK_CHARGE',
                    name: 'Bulwark Charge',
                    description: 'Shield Bash.',
                    slot: 'utility',
                    cooldown: 3,
                    currentCooldown: 0,
                    range: 1,
                    upgrades: [],
                    activeUpgrades: []
                };

                if (!nextState.player.activeSkills.some(s => s.id === 'BULWARK_CHARGE')) {
                    nextState.player = {
                        ...nextState.player,
                        activeSkills: [...nextState.player.activeSkills, bulwarkSkill]
                    };
                }
            }
            break;
        }

        case 'PickupSpear': {
            const pickupPos = effect.position || nextState.spearPosition;
            if (pickupPos && nextState.spearPosition && hexEquals(nextState.spearPosition, pickupPos)) {
                nextState.hasSpear = true;
                nextState.spearPosition = undefined;
            }
            break;
        }

        case 'SpawnItem': {
            if (effect.itemType === 'spear') {
                nextState.spearPosition = effect.position;
                if (context.sourceId === nextState.player.id) {
                    nextState.hasSpear = false;
                }
            } else if (effect.itemType === 'bomb') {
                const seed = nextState.initialSeed ?? nextState.rngSeed ?? '0';
                const counter = (nextState.turnNumber << 16)
                    + (nextState.actionLog?.length ?? 0)
                    + nextState.enemies.length;
                const bombId = `bomb-${stableIdFromSeed(seed, counter, 8, 'bomb')}`;
                const bomb: Actor = createEntity({
                    id: bombId,
                    type: 'enemy',
                    subtype: 'bomb',
                    factionId: 'enemy',
                    position: effect.position,
                    speed: 10,
                    skills: ['TIME_BOMB'],
                    weightClass: 'Standard',
                });
                bomb.statusEffects = [
                    {
                        id: 'TIME_BOMB',
                        type: 'time_bomb',
                        duration: 2,
                        tickWindow: 'END_OF_TURN',
                    },
                ];
                nextState.enemies = [...nextState.enemies, bomb];
            } else if (effect.itemType === 'shield') {
                nextState.shieldPosition = effect.position;
                nextState.hasShield = false;
            }
            break;
        }

        case 'LavaSink': {
            nextState = appendTimelineEvent(
                nextState,
                'HAZARD_CHECK',
                'LavaSink',
                { target: effect.target },
                context,
                true,
                240
            );
            const targetId = effect.target;
            const actor = targetId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetId);
                if (actor) {
                    nextState = appendTimelineEvent(
                        nextState,
                        'DEATH_RESOLVE',
                        'LavaSink',
                        { targetId },
                        { ...context, targetId },
                        true,
                        280
                    );
                    if (targetId === nextState.player.id) {
                        nextState.player = applyDamage(nextState.player, 99);
                    } else {
                        nextState.enemies = nextState.enemies.filter(e => e.id !== targetId);
                        nextState.dyingEntities = [...(nextState.dyingEntities || []), actor];
                        nextState = addCorpseTraitAt(nextState, actor.position);
                    }
                    nextState.visualEvents = [...(nextState.visualEvents || []),
                    { type: 'vfx', payload: { type: 'vaporize', position: actor.position } }
                    ];
                }
            break;
        }

        case 'Impact': {
            const targetId = effect.target;
            const actor = targetId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetId);
            if (actor) {
                const collisionDir = effect.direction;
                const projectedContactHex = collisionDir
                    ? {
                        q: actor.position.q + collisionDir.q,
                        r: actor.position.r + collisionDir.r,
                        s: actor.position.s + collisionDir.s
                    }
                    : undefined;
                const contactWorld = projectedContactHex ? getHexEdgeContactWorld(actor.position, projectedContactHex) : undefined;
                nextState = appendJuiceSignature(nextState, {
                    template: {
                        signature: collisionDir ? 'ENV.COLLISION.KINETIC.IMPACT' : 'ATK.STRIKE.PHYSICAL.IMPACT',
                        family: collisionDir ? 'environment' : 'attack',
                        primitive: collisionDir ? 'collision' : 'strike',
                        phase: 'impact',
                        element: collisionDir ? 'kinetic' : 'physical',
                        variant: collisionDir ? 'impact' : 'impact',
                        sourceRef: { kind: 'source_actor' },
                        targetRef: { kind: 'target_actor' },
                        contactRef: { kind: 'contact_world' }
                    },
                    sourceId: context.sourceId,
                    targetId,
                    sourceHex: resolveActorById(nextState, context.sourceId)?.position,
                    targetHex: actor.position,
                    contactHex: projectedContactHex,
                    contactWorld,
                    direction: effect.direction,
                    intensity: effect.damage > 1 ? 'high' : 'medium',
                    flags: { blocked: Boolean(collisionDir) },
                    meta: {
                        legacyJuiceId: 'impact',
                        legacyMirrored: true,
                        reason: 'impact'
                    }
                });
                if (effect.damage > 0) {
                    if (targetId === nextState.player.id) {
                        nextState.player = applyDamage(nextState.player, effect.damage);
                    } else {
                        const updateImpact = (e: Actor) => e.id === targetId ? applyDamage(e, effect.damage) : e;
                        nextState.enemies = nextState.enemies.map(updateImpact).filter(e => e.hp > 0);
                        if (nextState.companions) {
                            nextState.companions = nextState.companions.map(updateImpact).filter(e => e.hp > 0);
                        }
                    }
                }
            }
            break;
        }

        case 'Message': {
            nextState.message = [...nextState.message, tagMessage(effect.text, 'INFO', 'SYSTEM')].slice(-50);
            nextState = appendSimulationEvent(nextState, {
                type: 'MessageLogged',
                payload: { text: effect.text }
            });
            break;
        }

        case 'Juice': {
            const juiceMeta = (effect.metadata || {}) as Record<string, any>;
            const signaturePhase = (typeof juiceMeta.phase === 'string' ? juiceMeta.phase : undefined) as any;
            const legacyTemplate = getLegacyJuiceSignatureTemplate(effect.effect, {
                color: effect.color,
                text: effect.text
            });
            const template = {
                ...legacyTemplate,
                ...(typeof juiceMeta.signature === 'string' ? { signature: juiceMeta.signature } : {}),
                ...(typeof juiceMeta.family === 'string' ? { family: juiceMeta.family } : {}),
                ...(typeof juiceMeta.primitive === 'string' ? { primitive: juiceMeta.primitive } : {}),
                ...(typeof juiceMeta.element === 'string' ? { element: juiceMeta.element } : {}),
                ...(typeof juiceMeta.variant === 'string' ? { variant: juiceMeta.variant } : {}),
                ...(typeof juiceMeta.sourceRef === 'object' && juiceMeta.sourceRef ? { sourceRef: juiceMeta.sourceRef } : {}),
                ...(typeof juiceMeta.targetRef === 'object' && juiceMeta.targetRef ? { targetRef: juiceMeta.targetRef } : {}),
                ...(typeof juiceMeta.contactRef === 'object' && juiceMeta.contactRef ? { contactRef: juiceMeta.contactRef } : {})
            } as typeof legacyTemplate;
            const sourceActor = resolveActorById(nextState, context.sourceId);
            let signatureTargetId: string | undefined;
            let signatureTargetHex: Point | undefined;
            if (typeof effect.target === 'string') {
                signatureTargetId = effect.target === 'targetActor' ? (context.targetId || undefined) : effect.target;
                signatureTargetHex = resolveActorById(nextState, signatureTargetId)?.position;
            } else if (effect.target) {
                signatureTargetHex = effect.target;
                signatureTargetId = resolveActorAt(nextState, effect.target)?.id;
            } else if (context.targetId) {
                signatureTargetId = context.targetId;
                signatureTargetHex = resolveActorById(nextState, context.targetId)?.position;
            }

            const contactHex = (juiceMeta.contactHex && typeof juiceMeta.contactHex.q === 'number')
                ? juiceMeta.contactHex as Point
                : undefined;
            let contactWorld = (juiceMeta.contactWorld && typeof juiceMeta.contactWorld.x === 'number')
                ? juiceMeta.contactWorld as { x: number; y: number }
                : undefined;
            if (!contactWorld) {
                const contactFromHex = (juiceMeta.contactFromHex && typeof juiceMeta.contactFromHex.q === 'number')
                    ? juiceMeta.contactFromHex as Point
                    : undefined;
                const contactToHex = (juiceMeta.contactToHex && typeof juiceMeta.contactToHex.q === 'number')
                    ? juiceMeta.contactToHex as Point
                    : undefined;
                contactWorld = getHexEdgeContactWorld(contactFromHex, contactToHex);
            }

            nextState = appendJuiceSignature(nextState, {
                template,
                sourceId: context.sourceId,
                targetId: signatureTargetId,
                skillId: typeof juiceMeta.skillId === 'string' ? juiceMeta.skillId : undefined,
                reason: typeof juiceMeta.reason === 'string' ? juiceMeta.reason : undefined,
                sourceHex: sourceActor?.position,
                targetHex: signatureTargetHex,
                contactHex,
                contactWorld,
                path: effect.path,
                direction: effect.direction,
                phase: signaturePhase,
                sequenceId: typeof juiceMeta.sequenceId === 'string'
                    ? juiceMeta.sequenceId
                    : buildJuiceSequenceId(nextState, {
                        sourceId: context.sourceId,
                        skillId: typeof juiceMeta.skillId === 'string' ? juiceMeta.skillId : undefined,
                        phase: (signaturePhase || template.phase),
                        salt: effect.effect
                    }),
                intensity: effect.intensity,
                text: effect.text ? {
                    value: effect.text,
                    tone: (typeof juiceMeta.textTone === 'string' ? juiceMeta.textTone : 'system') as any,
                    color: effect.color
                } : undefined,
                timing: (typeof juiceMeta.timing === 'object' && juiceMeta.timing)
                    ? juiceMeta.timing
                    : effect.duration ? { durationMs: effect.duration, ttlMs: effect.duration } : undefined,
                camera: (typeof juiceMeta.camera === 'object' && juiceMeta.camera)
                    ? juiceMeta.camera
                    : effect.effect === 'shake'
                    ? { shake: effect.intensity || 'medium' }
                    : effect.effect === 'freeze'
                        ? { freezeMs: Math.max(0, Number(effect.duration || 80)) }
                        : undefined,
                area: (typeof juiceMeta.area === 'object' && juiceMeta.area) ? juiceMeta.area : undefined,
                flags: (typeof juiceMeta.flags === 'object' && juiceMeta.flags) ? juiceMeta.flags : undefined,
                meta: {
                    legacyJuiceId: effect.effect,
                    legacyMirrored: LEGACY_MIRRORED_JUICE_IDS.has(effect.effect),
                    ...(typeof juiceMeta.statusId === 'string' ? { statusId: juiceMeta.statusId } : {})
                }
            });

            if (effect.effect === 'combat_text' && effect.text) {
                nextState.message = appendTaggedMessage(nextState.message, effect.text, 'VERBOSE', 'SYSTEM');
            }
            if (effect.effect === 'shake') {
                nextState.visualEvents = [...(nextState.visualEvents || []), {
                    type: 'shake',
                    payload: { intensity: effect.intensity || 'medium', direction: effect.direction }
                }];
            }
            if (effect.effect === 'freeze') {
                nextState.visualEvents = [...(nextState.visualEvents || []), {
                    type: 'freeze',
                    payload: { durationMs: Math.max(0, Number(effect.duration || 80)) }
                }];
            }
            if (effect.effect === 'impact' && effect.target) {
                const targetPos = typeof effect.target === 'string'
                    ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                    : effect.target;
                if (targetPos) {
                    nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'impact', position: targetPos } }];
                }
            }
            if (effect.effect === 'flash' && effect.target) {
                const targetPos = typeof effect.target === 'string'
                    ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                    : effect.target;
                if (targetPos) {
                    nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'flash', position: targetPos } }];
                }
            }
            if (effect.effect === 'spearTrail' && effect.path) {
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'spear_trail', path: effect.path } }];
            }
            if (effect.effect === 'lavaSink' && effect.target) {
                const targetPos = typeof effect.target === 'string'
                    ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                    : (effect.target as Point);

                if (targetPos) {
                    const dying = nextState.enemies.find((e: Actor) => hexEquals(e.position, targetPos));
                    if (dying) {
                        nextState.dyingEntities = [...(nextState.dyingEntities || []), dying];
                        nextState.enemies = nextState.enemies.filter((e: Actor) => !hexEquals(e.position, targetPos));
                        if (nextState.companions) {
                            nextState.companions = nextState.companions.filter((e: Actor) => !hexEquals(e.position, targetPos));
                        }
                        nextState = addCorpseTraitAt(nextState, targetPos);
                        nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'vaporize', position: targetPos } }];
                    }
                }
            }
            break;
        }

        case 'UpdateComponent': {
            const updateActor = (actor: Actor, key: string, value: any): Actor => {
                const newComponents = new Map(actor.components || []);
                newComponents.set(key, value);
                return {
                    ...actor,
                    components: newComponents
                };
            };

            if (effect.target === 'self') {
                nextState.player = updateActor(nextState.player, effect.key, effect.value);
            } else if (effect.target === 'targetActor' && context.targetId) {
                if (context.targetId === nextState.player.id) {
                    nextState.player = updateActor(nextState.player, effect.key, effect.value);
                } else {
                    const updateComp = (e: Actor) => {
                        if (e.id === context.targetId) {
                            return updateActor(e, effect.key, effect.value);
                        }
                        return e;
                    };
                    nextState.enemies = nextState.enemies.map(updateComp);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateComp);
                    }
                }
            }
            break;
        }

        case 'ModifyCooldown': {
            const applyToActor = (actor: Actor): Actor => ({
                ...actor,
                activeSkills: actor.activeSkills?.map(s => {
                    if (s.id !== effect.skillId) return s;
                    return {
                        ...s,
                        currentCooldown: effect.setExact ? effect.amount : Math.max(0, s.currentCooldown + effect.amount)
                    };
                })
            });

            const actorId = context.sourceId || nextState.player.id;
            if (actorId === nextState.player.id) {
                nextState.player = applyToActor(nextState.player);
            } else {
                nextState.enemies = nextState.enemies.map(e => e.id === actorId ? applyToActor(e) : e);
                if (nextState.companions) {
                    nextState.companions = nextState.companions.map(e => e.id === actorId ? applyToActor(e) : e);
                }
            }
            break;
        }
        case 'SpawnCorpse': {
            nextState = addCorpseTraitAt(nextState, effect.position);
            break;
        }
        case 'RemoveCorpse': {
            nextState = removeCorpseTraitAt(nextState, effect.position);
            nextState.dyingEntities = (nextState.dyingEntities || []).filter(cp => !hexEquals(cp.position, effect.position));
            break;
        }
        case 'SpawnActor': {
            const normalizedActor = ensureActorTrinity(effect.actor);
            nextState.enemies = [...nextState.enemies, normalizedActor];
            if (normalizedActor.companionOf) {
                nextState.companions = [...(nextState.companions || []), normalizedActor];
            }
            if (nextState.initiativeQueue) {
                nextState.initiativeQueue = addToQueue(nextState.initiativeQueue, normalizedActor);
            }
            break;
        }
        case 'PlaceFire': {
            const key = pointToKey(effect.position);
            ensureTilesClone();
            let tile = nextState.tiles.get(key);
            if (!tile) {
                tile = {
                    baseId: 'STONE',
                    position: effect.position,
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
            nextState.tiles.set(key, tile);

            const result = TileResolver.applyEffect(tile, 'FIRE', effect.duration, 1, nextState, context.sourceId);
            if (result.messages.length > 0) {
                nextState.message = appendTaggedMessages(nextState.message, result.messages, 'INFO', 'HAZARD');
            }
            break;
        }

        case 'PlaceTrap': {
            if (!nextState.traps) nextState.traps = [];

            // Add new trap (IMMUTABLE)
            nextState.traps = [...nextState.traps, {
                position: effect.position,
                ownerId: effect.ownerId,
                isRevealed: false,
                cooldown: 0,
                volatileCore: effect.volatileCore,
                chainReaction: effect.chainReaction,
                resetCooldown: effect.resetCooldown
            }];
            break;
        }
        case 'RemoveTrap': {
            if (nextState.traps) {
                if ((effect as any).ownerId) {
                    nextState.traps = nextState.traps.filter(t => t.ownerId !== (effect as any).ownerId);
                } else {
                    nextState.traps = nextState.traps.filter(t =>
                        !hexEquals(t.position, effect.position)
                    );
                }
            }
            break;
        }
        case 'SetTrapCooldown': {
            if (nextState.traps) {
                nextState.traps = nextState.traps.map(t => {
                    if (effect.ownerId && t.ownerId !== effect.ownerId) return t;
                    if (!hexEquals(t.position, effect.position)) return t;
                    return {
                        ...t,
                        cooldown: Math.max(0, effect.cooldown)
                    };
                });
            }
            break;
        }
        case 'SetStealth': {
            const updateStealth = (actor: Actor) => ({ ...actor, stealthCounter: (actor.stealthCounter || 0) + effect.amount });

            if (effect.target === 'self') {
                nextState.player = updateStealth(nextState.player);
            } else {
                nextState.enemies = nextState.enemies.map(e => e.id === effect.target ? updateStealth(e) : e);
                if (nextState.companions) {
                    nextState.companions = nextState.companions.map(e => e.id === effect.target ? updateStealth(e) : e);
                }
            }
            break;
        }
        case 'UpdateCompanionState': {
            const targetId = effect.target === 'self' ? (context.sourceId || nextState.player.id) : effect.target;
            const updateFunc = (e: Actor) => {
                if (e.id !== targetId) return e;
                return {
                    ...e,
                    companionState: {
                        ...e.companionState,
                        mode: effect.mode || e.companionState?.mode,
                        markTarget: effect.markTarget !== undefined ? effect.markTarget : e.companionState?.markTarget,
                        orbitStep: effect.mode === 'scout' ? 0 : e.companionState?.orbitStep,
                        apexStrikeCooldown: effect.apexStrikeCooldown !== undefined ? effect.apexStrikeCooldown : e.companionState?.apexStrikeCooldown,
                        healCooldown: effect.healCooldown !== undefined ? effect.healCooldown : e.companionState?.healCooldown,
                    }
                } as Actor;
            };

            nextState.enemies = nextState.enemies.map(updateFunc);
            if (nextState.companions) {
                nextState.companions = nextState.companions.map(updateFunc);
            }
            break;
        }
        case 'GameOver': {
            nextState.gameStatus = 'lost';
            break;
        }
    }

    return nextState;
};



/**
 * Apply a list of effects to the game state.
 */
export const applyEffects = (state: GameState, effects: AtomicEffect[], context: { targetId?: string; sourceId?: string; stepId?: string } = {}): GameState => {
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
