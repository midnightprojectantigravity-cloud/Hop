import type { GameState, AtomicEffect, Actor, Point, MovementTrace } from './types';
import { hexEquals, getHexLine } from './hex';
import { applyDamage } from './actor';

import { nextIdFromState } from './rng';

/**
 * Apply a single atomic effect to the game state.
 */
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: { targetId?: string; sourceId?: string } = {}): GameState => {
    const nextState = { ...state };

    switch (effect.type) {
        case 'Displacement': {
            const actorId = effect.target === 'self' ? nextState.player.id : (context.targetId || '');
            const origin = effect.source || (effect.target === 'self' ? nextState.player.position : nextState.enemies.find(e => e.id === context.targetId)?.position);

            if (origin) {
                const path = getHexLine(origin, effect.destination);
                const trace: MovementTrace = {
                    actorId,
                    origin,
                    path,
                    destination: effect.destination,
                    wasLethal: nextState.lavaPositions.some(l => hexEquals(l, effect.destination))
                };
                nextState.visualEvents = [...(nextState.visualEvents || []), {
                    type: 'kinetic_trace' as const,
                    payload: trace
                }];
            }

            if (effect.target === 'self') {
                nextState.player = { ...nextState.player, position: effect.destination, previousPosition: nextState.player.position };
            } else if (effect.target === 'targetActor' && context.targetId) {
                if (context.targetId === nextState.player.id) {
                    nextState.player = { ...nextState.player, position: effect.destination, previousPosition: nextState.player.position };
                } else {
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === context.targetId) {
                            return { ...e, position: effect.destination, previousPosition: e.position };
                        }
                        return e;
                    });
                }
            }
            break;
        }

        case 'Damage': {
            if (effect.target === 'targetActor' && context.targetId) {
                if (context.targetId === nextState.player.id) {
                    nextState.player = applyDamage(nextState.player, effect.amount);
                } else {
                    const victim = nextState.enemies.find(e => e.id === context.targetId);
                    if (victim && victim.hp <= effect.amount) {
                        nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'freeze', payload: { duration: 80 } }];
                    }
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === context.targetId) {
                            const updated = applyDamage(e, effect.amount);
                            if (updated.hp <= 0) nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                            return updated;
                        }
                        return e;
                    }).filter((e: Actor) => e.hp > 0);
                }
                nextState.visualEvents = [...(nextState.visualEvents || []),
                { type: 'shake', payload: { intensity: effect.amount > 1 ? 'medium' : 'low' } },
                { type: 'combat_text', payload: { text: `-${effect.amount}`, targetId: context.targetId } }
                ];
            } else if (typeof effect.target === 'object' && 'q' in effect.target) {
                const targetPos = effect.target as Point;
                nextState.visualEvents = [...(nextState.visualEvents || []),
                { type: 'combat_text', payload: { text: `-${effect.amount}`, position: targetPos } }
                ];
                if (hexEquals(nextState.player.position, targetPos)) {
                    nextState.player = applyDamage(nextState.player, effect.amount);
                }
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        const updated = applyDamage(e, effect.amount);
                        if (updated.hp <= 0) nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                        return updated;
                    }
                    return e;
                }).filter((e: Actor) => e.hp > 0);
            }
            break;
        }

        case 'Heal': {
            if (effect.target === 'targetActor' && context.targetId) {
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
            }
            break;
        }

        case 'ApplyStatus': {
            const addStatus = (actor: Actor, status: 'stunned' | 'poisoned' | 'armored' | 'hidden', duration: number): Actor => {
                const id = `${status}_${Date.now()}`;
                return {
                    ...actor,
                    statusEffects: [...actor.statusEffects, { id, type: status, duration }]
                };
            };

            if (effect.target === 'targetActor' && context.targetId) {
                if (context.targetId === nextState.player.id) {
                    nextState.player = addStatus(nextState.player, effect.status, effect.duration);
                } else {
                    nextState.enemies = nextState.enemies.map((e: Actor) => {
                        if (e.id === context.targetId) {
                            return addStatus(e, effect.status, effect.duration);
                        }
                        return e;
                    });
                }
            } else if (typeof effect.target === 'object' && 'q' in effect.target) {
                const targetPos = effect.target as Point;
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        return addStatus(e, effect.status, effect.duration);
                    }
                    return e;
                });
            }

            if (effect.status === 'stunned') {
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'stun_stars', target: effect.target, targetId: context.targetId } }];
            }
            break;
        }

        case 'SpawnItem': {
            if (effect.itemType === 'spear') {
                nextState.spearPosition = effect.position;
                nextState.hasSpear = false;
            } else if (effect.itemType === 'bomb') {
                const res = nextIdFromState(nextState, 6);
                nextState.rngCounter = res.nextState.rngCounter;

                const bomb: Actor = {
                    id: `bomb-${res.id}`,
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
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'combat_text', payload: { text: effect.text, position: effect.target } }];
            }
            if (effect.effect === 'lavaSink' && effect.target) {
                const targetPos = effect.target as Point;
                const dying = nextState.enemies.find((e: Actor) => hexEquals(e.position, targetPos));
                if (dying) {
                    nextState.dyingEntities = [...(nextState.dyingEntities || []), dying];
                    nextState.enemies = nextState.enemies.filter((e: Actor) => !hexEquals(e.position, targetPos));
                    nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'vaporize', position: targetPos } }];
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
    }

    return nextState;
};

import { themeInterceptors } from './themeLogic';

/**
 * Apply a list of effects to the game state.
 */
export const applyEffects = (state: GameState, effects: AtomicEffect[], context: { targetId?: string; sourceId?: string } = {}): GameState => {
    // 1. Pass all effects through the theme interceptor pipeline
    const interceptedEffects: AtomicEffect[] = [];
    for (const eff of effects) {
        interceptedEffects.push(...themeInterceptors(eff, state, context));
    }

    // 2. Resolve final effects
    return interceptedEffects.reduce((s, eff) => applyAtomicEffect(s, eff, context), state);
};
