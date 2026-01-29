import type { GameState, AtomicEffect, Actor, Point, MovementTrace, StatusEffect } from '../types';
import { hexEquals, getHexLine, getDirectionFromTo } from '../hex';
import { applyDamage, checkVitals } from './actor';
import { STATUS_REGISTRY } from '../constants';

import { addToQueue } from './initiative';
import { TileResolver } from './tile-effects';
import { pointToKey } from '../hex';
import { BASE_TILES } from './tile-registry';


/**
 * Apply a single atomic effect to the game state.
 */
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: { targetId?: string; sourceId?: string } = {}): GameState => {
    const nextState = { ...state };

    switch (effect.type) {
        case 'Displacement': {
            let targetActorId = '';
            if (effect.target === 'self') targetActorId = nextState.player.id;
            else if (effect.target === 'targetActor') targetActorId = context.targetId || '';
            else targetActorId = effect.target; // Literal ID

            if (!targetActorId) break;

            const actor = (targetActorId === nextState.player.id)
                ? nextState.player
                : nextState.enemies.find(e => e.id === targetActorId);

            const origin = effect.source || actor?.position;

            if (origin) {
                const path = getHexLine(origin, effect.destination);
                const trace: MovementTrace = {
                    actorId: targetActorId,
                    origin,
                    path,
                    destination: effect.destination,
                    wasLethal: nextState.tiles.get(pointToKey(effect.destination))?.traits.has('HAZARDOUS') || false
                };
                nextState.visualEvents = [...(nextState.visualEvents || []), {
                    type: 'kinetic_trace' as const,
                    payload: trace
                }];
            }

            if (targetActorId === nextState.player.id) {
                nextState.player = { ...nextState.player, position: effect.destination, previousPosition: nextState.player.position };
            } else {
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (e.id === targetActorId) {
                        return { ...e, position: effect.destination, previousPosition: e.position };
                    }
                    return e;
                });
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

            if (targetActorId) {
                if (targetActorId === nextState.player.id) {
                    nextState.player = applyDamage(nextState.player, effect.amount);
                } else {
                    const victim = nextState.enemies.find(e => e.id === targetActorId);
                    const victimPos = targetActorId === nextState.player.id ? nextState.player.position : victim?.position;

                    if (victim && victim.hp <= effect.amount) {
                        nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'freeze', payload: { duration: 80 } }];
                    }
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === targetActorId) {
                            const updated = applyDamage(e, effect.amount);
                            if (updated.hp <= 0) {
                                nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                            }
                            return updated;
                        }
                        return e;
                    }).filter((e: Actor) => e.hp > 0);

                    nextState.visualEvents = [...(nextState.visualEvents || []),
                    { type: 'shake', payload: { intensity: effect.amount > 1 ? 'medium' : 'low' } },
                    { type: 'combat_text', payload: { text: `-${effect.amount}`, targetId: targetActorId, position: victimPos } },
                    { type: 'vfx', payload: { type: 'impact', position: victimPos } }
                    ];

                    // Stealth Decay: Taking damage reduces stealth
                    if (victim && (victim.stealthCounter || 0) > 0) {
                        nextState.enemies = nextState.enemies.map(e =>
                            e.id === targetActorId ? { ...e, stealthCounter: Math.max(0, (e.stealthCounter || 0) - 1) } : e
                        );
                    }
                    if (targetActorId === nextState.player.id && (nextState.player.stealthCounter || 0) > 0) {
                        nextState.player = { ...nextState.player, stealthCounter: Math.max(0, (nextState.player.stealthCounter || 0) - 1) };
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
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        const updated = applyDamage(e, effect.amount);
                        if (updated.hp <= 0) {
                            nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                        }
                        return updated;
                    }
                    return e;
                }).filter((e: Actor) => e.hp > 0);
            }
            break;
        }

        case 'Heal': {
            if (effect.target === 'targetActor' && context.targetId) {
                const victim = context.targetId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === context.targetId);
                if (context.targetId === nextState.player.id) {
                    nextState.player = { ...nextState.player, hp: Math.min(nextState.player.maxHp, nextState.player.hp + effect.amount) };
                } else {
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === context.targetId) {
                            return { ...e, hp: Math.min(e.maxHp, e.hp + effect.amount) };
                        }
                        return e;
                    });
                }
                if (victim) {
                    nextState.visualEvents = [...(nextState.visualEvents || []),
                    { type: 'combat_text', payload: { text: `+${effect.amount}`, position: victim.position } }
                    ];
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
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === targetActorId) {
                            const result = addStatusWithMetadata(e, effect.status, effect.duration, nextState);
                            nextState.rngCounter = result.nextState.rngCounter;
                            return result.actor;
                        }
                        return e;
                    });
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
                        nextState.enemies = nextState.enemies.map(e => e.id === targetId ? applyDamage(e, effect.damage) : e);
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
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === context.targetId) {
                            return updateActor(e, effect.key, effect.value);
                        }
                        return e;
                    });
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
            break;
        }
        case 'RemoveTrap': {
            break;
        }
        case 'SetStealth': {
            const updateStealth = (actor: Actor) => ({ ...actor, stealthCounter: (actor.stealthCounter || 0) + effect.amount });

            if (effect.target === 'self') {
                nextState.player = updateStealth(nextState.player);
            } else {
                nextState.enemies = nextState.enemies.map(e => e.id === effect.target ? updateStealth(e) : e);
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
