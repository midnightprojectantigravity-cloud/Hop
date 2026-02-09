import type { GameState, AtomicEffect, Actor, Point, MovementTrace } from '../types';
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

const appendTimelineEvent = (
    state: GameState,
    phase: 'MOVE_START' | 'MOVE_END' | 'ON_PASS' | 'ON_ENTER' | 'HAZARD_CHECK' | 'STATUS_APPLY' | 'DAMAGE_APPLY' | 'DEATH_RESOLVE' | 'INTENT_START' | 'INTENT_END',
    type: string,
    payload: any,
    context: { targetId?: string; sourceId?: string },
    blocking: boolean,
    suggestedDurationMs: number
): GameState => {
    const events = state.timelineEvents || [];
    const idx = events.length;
    const turn = state.turnNumber || 0;
    const actorId = context.sourceId || context.targetId;
    const groupId = `${turn}:${actorId || 'system'}`;
    const id = `${groupId}:${idx}:${phase}`;
    return {
        ...state,
        timelineEvents: [
            ...events,
            {
                id,
                turn,
                actorId,
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


/**
 * Apply a single atomic effect to the game state.
 */
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: { targetId?: string; sourceId?: string } = {}): GameState => {
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
            let moveEndedEventEmitted = false;
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
                        nextState.message = [...nextState.message, ...pathResult.result.messages].slice(-50);
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
                            nextState.message = [...nextState.message, ...entryResult.messages].slice(-50);
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
                                        nextState.message = [...nextState.message, ...transition.messages].slice(-50);
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

                const trace: MovementTrace = {
                    actorId: targetActorId,
                    origin,
                    path: getHexLine(origin, finalDestination),
                    destination: finalDestination,
                    wasLethal: nextState.tiles.get(pointToKey(finalDestination))?.traits.has('HAZARDOUS') || false
                };

                nextState.visualEvents = [...(nextState.visualEvents || []), {
                    type: 'kinetic_trace' as const,
                    payload: trace
                }];

                if (targetActorId === nextState.player.id) {
                    nextState.player = { ...nextState.player, position: finalDestination, previousPosition: nextState.player.position };
                } else {
                    const updatePos = (e: Actor) => e.id === targetActorId ? { ...e, position: finalDestination, previousPosition: e.position } : e;
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
            }
            break;
        }

        case 'Damage': {
            if (effect.scoreEvent) {
                nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), effect.scoreEvent].slice(-500);
            }
            const isHazardReason = !!effect.reason && ['lava_sink', 'void_sink', 'hazard_intercept', 'lava_tick', 'fire_damage'].includes(effect.reason);
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
                    nextState.message = [...(nextState.message || []), 'Ember Ward dampens the flames.'].slice(-50);
                }

                if (hasAbsorb) {
                    const healAmount = adjustedAmount + (targetActorId === nextState.player.id && hasCinderOrb ? 1 : 0);
                    if (targetActorId === nextState.player.id && hasCinderOrb) {
                        nextState.message = [...(nextState.message || []), 'Cinder Orb amplifies the absorption.'].slice(-50);
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
                    let damageAmount = effect.amount;
                    if (isFireDamage && hasEmberWard) {
                        damageAmount = Math.max(0, damageAmount - 1);
                    }
                    nextState.player = applyDamage(nextState.player, damageAmount);
                    if (isFireDamage) {
                        nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                    }
                    if (isFireDamage && hasCinderOrb) {
                        nextState.player = applyHeal(nextState.player, 1);
                        nextState.message = [...(nextState.message || []), 'Cinder Orb restores 1 HP.'].slice(-50);
                    }
                } else {
                    const victim = nextState.enemies.find(e => e.id === targetActorId);
                    const victimPos = targetActorId === nextState.player.id ? nextState.player.position : victim?.position;
                    const corpsePositions: Point[] = [];

                    if (victim && victim.hp <= effect.amount) {
                        nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'freeze', payload: { duration: 80 } }];
                    }
                    const updateDamage = (e: Actor) => {
                        if (e.id === targetActorId) {
                            const updated = applyDamage(e, effect.amount);
                            if (updated.hp <= 0) {
                                nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                                corpsePositions.push(e.position);
                            }
                            return updated;
                        }
                        return e;
                    };
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

                    nextState.visualEvents = [...(nextState.visualEvents || []),
                    { type: 'shake', payload: { intensity: effect.amount > 1 ? 'medium' : 'low' } },
                    { type: 'combat_text', payload: { text: `-${effect.amount}`, targetId: targetActorId, position: victimPos } },
                    { type: 'vfx', payload: { type: 'impact', position: victimPos } }
                    ];

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
                            nextState.visualEvents.push({ type: 'combat_text', payload: { position: nextState.player.position, text: 'Auto-Roll!' } });
                            nextState.message = [...(nextState.message || []), `You roll away!`];
                        }
                    }

                    // Hunter Passive (Enemy): Swift Roll away from attacker
                    if (victim && victim.archetype === 'HUNTER' && (effect as any).source) {
                        const rollDirIdx = getDirectionFromTo((effect as any).source, victim.position);
                        if (rollDirIdx !== -1) {
                            nextState.message = [...(nextState.message || []), `${victim.subtype || victim.id} rolls away!`];
                        }
                    }
                }
            } else if (targetPos) {
                nextState.visualEvents = [...(nextState.visualEvents || []),
                { type: 'combat_text', payload: { text: `-${effect.amount}`, position: targetPos } },
                { type: 'vfx', payload: { type: 'impact', position: targetPos } }
                ];
                if (hexEquals(nextState.player.position, targetPos)) {
                    nextState.player = applyDamage(nextState.player, effect.amount);
                    if (isFireDamage) {
                        nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                    }
                    if (nextState.player.hp <= 0) {
                        // Game over handled by vitals check
                    }
                }
                const updateDamageAt = (e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        const updated = applyDamage(e, effect.amount);
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
            break;
        }

        case 'Heal': {
            const healActor = (actor: Actor): Actor => ({ ...actor, hp: Math.min(actor.maxHp, actor.hp + effect.amount) });
            const targetId = effect.target === 'targetActor' ? context.targetId : effect.target;

            if (targetId) {
                const victim = targetId === nextState.player.id ? nextState.player : (nextState.enemies.find(e => e.id === targetId) || nextState.companions?.find(e => e.id === targetId));
                if (victim) {
                    nextState.visualEvents = [...(nextState.visualEvents || []),
                    { type: 'combat_text', payload: { text: `+${effect.amount}`, position: victim.position } }
                    ];

                    if (targetId === nextState.player.id) {
                        nextState.player = healActor(nextState.player);
                    } else {
                        const updateHeal = (e: Actor) => e.id === targetId ? healActor(e) : e;
                        nextState.enemies = nextState.enemies.map(updateHeal);
                        if (nextState.companions) {
                            nextState.companions = nextState.companions.map(updateHeal);
                        }
                    }
                }
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
                    const name = targetActorId === nextState.player.id ? 'You' : (targetActor.subtype || targetActor.id);
                    const suffix = targetActorId === nextState.player.id ? 'are' : 'is';
                    nextState.message = [...(nextState.message || []), `${name} ${suffix} ${effect.status}!`].slice(-50);

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
                { type: 'vfx', payload: { type: 'stunBurst', position: resolvedPos } },
                { type: 'combat_text', payload: { text: 'STUNNED', position: resolvedPos } }
                ];
            }
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
                const bomb: Actor = {
                    ...createEntity({
                        id: bombId,
                        type: 'enemy',
                        subtype: 'bomb',
                        factionId: 'enemy',
                        position: effect.position,
                        hp: 1,
                        maxHp: 1,
                        speed: 10,
                        skills: [],
                        weightClass: 'Standard',
                    }),
                    actionCooldown: 2,
                };
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
                nextState.visualEvents = [...(nextState.visualEvents || []),
                { type: 'shake', payload: { intensity: 'medium', direction: effect.direction } },
                { type: 'vfx', payload: { type: 'impact', position: actor.position } },
                { type: 'combat_text', payload: { text: `Impact!`, position: actor.position } }
                ];
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
            nextState.message = [...nextState.message, effect.text].slice(-50);
            break;
        }

        case 'Juice': {
            if (effect.effect === 'shake') {
                nextState.isShaking = true;
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'shake', payload: { intensity: effect.intensity || 'medium', direction: effect.direction } }];
            }
            if (effect.effect === 'freeze') {
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'freeze', payload: { duration: 80 } }];
            }
            if (effect.effect === 'combat_text' && effect.text) {
                const targetPos = typeof effect.target === 'string'
                    ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                    : effect.target;
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'combat_text', payload: { text: effect.text, position: targetPos } }];
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
            nextState.player = {
                ...nextState.player,
                activeSkills: nextState.player.activeSkills?.map(s => {
                    if (s.id === effect.skillId) {
                        return {
                            ...s,
                            currentCooldown: effect.setExact ? effect.amount : Math.max(0, s.currentCooldown + effect.amount)
                        };
                    }
                    return s;
                })
            };
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
                nextState.message = [...nextState.message, ...result.messages].slice(-50);
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
                cooldown: 0
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
export const applyEffects = (state: GameState, effects: AtomicEffect[], context: { targetId?: string; sourceId?: string } = {}): GameState => {
    // Legacy themeInterceptors decommissioned. 
    // Hazard logic is now unified in TileResolver and executed during Displacement or turn ends.

    // Resolve final effects
    let nextState = effects.reduce((s, eff) => applyAtomicEffect(s, eff, context), state);

    // Post-Effect Vitals Check (Life & Death)
    const vitalEffects = checkVitals(nextState);
    if (vitalEffects.length > 0) {
        nextState = vitalEffects.reduce((s, eff) => applyAtomicEffect(s, eff, {}), nextState);
    }

    return nextState;
};
