import type { GameState, AtomicEffect, Actor, Point, MovementTrace, StatusEffect } from '../types';
import { hexEquals, getHexLine, getDirectionFromTo, hexDirection, hexAdd } from '../hex';
import { applyDamage, checkVitals } from './actor';
import { STATUS_REGISTRY } from '../constants';

import { addToQueue } from './initiative';
import { TileResolver } from './tile-effects';
import { pointToKey } from '../hex';
import { BASE_TILES } from './tile-registry';
import { UnifiedTileService } from './unified-tile-service';


/**
 * Apply a single atomic effect to the game state.
 */
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: { targetId?: string; sourceId?: string } = {}): GameState => {
    let nextState = { ...state };

    switch (effect.type) {
        case 'Displacement': {
            let targetActorId = '';
            if (effect.target === 'self') targetActorId = context.sourceId || nextState.player.id;
            else if (effect.target === 'targetActor') targetActorId = context.targetId || '';
            else targetActorId = effect.target; // Literal ID

            if (!targetActorId) break;

            const actor = (targetActorId === nextState.player.id)
                ? nextState.player
                : nextState.enemies.find(e => e.id === targetActorId);

            const origin = effect.source || actor?.position;

            if (origin) {
                const path = effect.path || (origin ? getHexLine(origin, effect.destination) : undefined);
                // Simulate if explicitly requested, if it's a fling, or if a path was already provided
                const shouldSimulate = (effect as any).simulatePath || effect.isFling || !!effect.path;

                let finalDestination = effect.destination;

                if (shouldSimulate && path) {
                    // Unified Spatial Logic: All displacements now respect tile-based momentum/hazards!
                    // We pass path.length - 1 as the "intrinsic momentum" of the displacement to ensure it finishes exactly at destination unless slippery.
                    const pathResult = TileResolver.processPath(actor as Actor, path.slice(1), nextState, path.length - 1, {
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
                    if (pathResult.result.effects.length > 0) {
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
                        const entryResult = TileResolver.processEntry(actor as Actor, finalTile, nextState);
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
            }
            break;
        }

        case 'Damage': {
            let targetActorId = '';
            let targetPos: Point | null = null;

            if (typeof effect.target === 'string') {
                if (effect.target === 'targetActor') targetActorId = context.targetId || '';
                else if (effect.target !== 'area') targetActorId = effect.target; // Literal ID
            } else {
                targetPos = effect.target as Point;
            }

            // ABSORB_FIRE Logic: Intercept Fire Damage
            const fireReasons = ['fire_damage', 'lava_sink', 'burning', 'hazard_intercept'];
            const isFireDamage = effect.reason && fireReasons.includes(effect.reason);

            if (isFireDamage && targetActorId) {
                const victim = targetActorId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetActorId);
                const hasAbsorb = victim?.activeSkills?.some(s => s.id === 'ABSORB_FIRE');

                if (hasAbsorb) {
                    // Convert to Heal
                    return applyAtomicEffect(nextState, {
                        type: 'Heal',
                        target: targetActorId,
                        amount: effect.amount
                    });
                }
            }

            if (targetActorId) {
                if (targetActorId === nextState.player.id) {
                    nextState.player = applyDamage(nextState.player, effect.amount);
                } else {
                    const victim = nextState.enemies.find(e => e.id === targetActorId);
                    const victimPos = targetActorId === nextState.player.id ? nextState.player.position : victim?.position;

                    if (victim && victim.hp <= effect.amount) {
                        nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'freeze', payload: { duration: 80 } }];
                    }
                    const updateDamage = (e: Actor) => {
                        if (e.id === targetActorId) {
                            const updated = applyDamage(e, effect.amount);
                            if (updated.hp <= 0) {
                                nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                            }
                            return updated;
                        }
                        return e;
                    };
                    nextState.enemies = nextState.enemies.map(updateDamage).filter((e: Actor) => e.hp > 0);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateDamage).filter((e: Actor) => e.hp > 0);
                    }

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
                    if (nextState.player.hp <= 0) {
                        // Game over handled by vitals check
                    }
                }
                const updateDamageAt = (e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        const updated = applyDamage(e, effect.amount);
                        if (updated.hp <= 0) {
                            nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                        }
                        return updated;
                    }
                    return e;
                };
                nextState.enemies = nextState.enemies.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
                if (nextState.companions) {
                    nextState.companions = nextState.companions.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
                }
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
            const getStatusWindow = (type: string) =>
                STATUS_REGISTRY[type as keyof typeof STATUS_REGISTRY]?.tickWindow || 'END_OF_TURN';

            const addStatusWithMetadata = (actor: Actor, statusType: any, duration: number, stateObj: GameState): { actor: Actor; nextState: GameState } => {
                const id = `STATUS_${Date.now()}`;

                // Retrieve the window from our registry
                const tickWindow = getStatusWindow(statusType);

                const newStatus: StatusEffect = {
                    id,
                    type: statusType,
                    duration,
                    tickWindow
                };

                return {
                    actor: {
                        ...actor,
                        statusEffects: [...actor.statusEffects, newStatus]
                    },
                    nextState: { ...stateObj }
                };
            };

            let targetActorId = '';
            let targetPos: Point | null = null;
            if (typeof effect.target === 'string') {
                if (effect.target === 'targetActor') targetActorId = context.targetId || '';
                else targetActorId = effect.target; // Literal ID
            } else {
                targetPos = effect.target as Point;
            }

            let resolvedPos = targetPos;

            if (targetActorId) {
                if (targetActorId === nextState.player.id) {
                    resolvedPos = nextState.player.position;
                    const result = addStatusWithMetadata(nextState.player, effect.status, effect.duration, nextState);
                    nextState.player = result.actor;
                    nextState.rngCounter = result.nextState.rngCounter;
                } else {
                    const updateStatus = (e: Actor) => {
                        if (e.id === targetActorId) {
                            const result = addStatusWithMetadata(e, effect.status, effect.duration, nextState);
                            nextState.rngCounter = result.nextState.rngCounter;
                            return result.actor;
                        }
                        return e;
                    };
                    nextState.enemies = nextState.enemies.map(updateStatus);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateStatus);
                    }
                }
            }

            if (effect.status === 'stunned' && resolvedPos) {
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'impact', position: resolvedPos } }];
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

        case 'SpawnItem': {
            if (effect.itemType === 'spear') {
                nextState.spearPosition = effect.position;
                if (context.sourceId === nextState.player.id) {
                    nextState.hasSpear = false;
                }
            } else if (effect.itemType === 'bomb') {
                const bombId = `bomb-${Date.now()}`;

                const bomb: Actor = {
                    id: bombId,
                    type: 'enemy',
                    subtype: 'bomb',
                    factionId: 'enemy',
                    position: effect.position,
                    hp: 1,
                    maxHp: 1,
                    speed: 10,
                    actionCooldown: 2,
                    statusEffects: [],
                    temporaryArmor: 0,
                    activeSkills: []
                };
                nextState.enemies = [...nextState.enemies, bomb];
            } else if (effect.itemType === 'shield') {
                nextState.shieldPosition = effect.position;
                nextState.hasShield = false;
            }
            break;
        }

        case 'LavaSink': {
            const targetId = effect.target;
            const actor = targetId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetId);
            if (actor) {
                if (targetId === nextState.player.id) {
                    nextState.player = applyDamage(nextState.player, 99);
                } else {
                    nextState.enemies = nextState.enemies.filter(e => e.id !== targetId);
                    nextState.dyingEntities = [...(nextState.dyingEntities || []), actor];
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
            // Corpses now represented by dead actors in dyingEntities or tile data if we add it
            break;
        }
        case 'RemoveCorpse': {
            break;
        }
        case 'SpawnActor': {
            nextState.enemies = [...nextState.enemies, effect.actor];
            if (effect.actor.companionOf) {
                nextState.companions = [...(nextState.companions || []), effect.actor];
            }
            if (nextState.initiativeQueue) {
                nextState.initiativeQueue = addToQueue(nextState.initiativeQueue, effect.actor);
            }
            break;
        }
        case 'PlaceFire': {
            const key = pointToKey(effect.position);
            let tile = nextState.tiles.get(key);
            if (!tile) {
                tile = {
                    baseId: 'STONE',
                    position: effect.position,
                    traits: new Set(BASE_TILES.STONE!.defaultTraits),
                    effects: []
                };
                nextState.tiles.set(key, tile);
            }

            const result = TileResolver.applyEffect(tile, 'FIRE', effect.duration, 1, nextState, context.sourceId);
            if (result.messages.length > 0) {
                nextState.message = [...nextState.message, ...result.messages].slice(-50);
            }
            break;
        }

        case 'PlaceTrap': {
            if (!nextState.traps) nextState.traps = [];

            // Add new trap
            nextState.traps.push({
                position: effect.position,
                ownerId: effect.ownerId,
                isRevealed: false,
                cooldown: 0
            });
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
