import type { GameState, AtomicEffect, Actor, Point } from './types';
import { hexEquals } from './hex';
import { applyDamage } from './actor';

/**
 * Apply a single atomic effect to the game state.
 */
export const applyAtomicEffect = (state: GameState, effect: AtomicEffect, context: { targetId?: string } = {}): GameState => {
    const nextState = { ...state };

    switch (effect.type) {
        case 'Displacement': {
            if (effect.target === 'self') {
                nextState.player = { ...nextState.player, position: effect.destination, previousPosition: nextState.player.position };
            } else if (effect.target === 'targetActor' && context.targetId) {
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (e.id === context.targetId) {
                        return { ...e, position: effect.destination, previousPosition: e.position };
                    }
                    return e;
                });
            }
            break;
        }

        case 'Damage': {
            if (effect.target === 'targetActor' && context.targetId) {
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (e.id === context.targetId) {
                        return applyDamage(e, effect.amount);
                    }
                    return e;
                }).filter((e: Actor) => e.hp > 0);
            } else if (typeof effect.target === 'object' && 'q' in effect.target) {
                const targetPos = effect.target as Point;
                if (hexEquals(nextState.player.position, targetPos)) {
                    nextState.player = applyDamage(nextState.player, effect.amount);
                }
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (hexEquals(e.position, targetPos)) {
                        return applyDamage(e, effect.amount);
                    }
                    return e;
                }).filter((e: Actor) => e.hp > 0);
            }
            break;
        }

        case 'ApplyStatus': {
            if (effect.target === 'targetActor' && context.targetId) {
                nextState.enemies = nextState.enemies.map((e: Actor) => {
                    if (e.id === context.targetId) {
                        if (effect.status === 'stunned') return { ...e, isStunned: true };
                    }
                    return e;
                });
            }
            break;
        }

        case 'SpawnItem': {
            if (effect.itemType === 'spear') {
                nextState.spearPosition = effect.position;
                nextState.hasSpear = false;
            } else if (effect.itemType === 'bomb') {
                const bomb: Actor = {
                    id: `bomb-${Date.now()}-${Math.random()}`,
                    type: 'enemy',
                    subtype: 'bomb',
                    position: effect.position,
                    hp: 1,
                    maxHp: 1,
                    actionCooldown: 2 // 2 turns to explode
                };
                nextState.enemies = [...nextState.enemies, bomb];
            }
            break;
        }

        case 'Message': {
            nextState.message = [...nextState.message, effect.text].slice(-50);
            break;
        }

        case 'Juice': {
            if (effect.effect === 'shake') nextState.isShaking = true;
            if (effect.effect === 'lavaSink' && effect.target) {
                // Find entity at target and add to dying
                const targetPos = effect.target as Point;
                const dying = nextState.enemies.find((e: Actor) => hexEquals(e.position, targetPos));
                if (dying) {
                    nextState.dyingEntities = [...(nextState.dyingEntities || []), dying];
                    nextState.enemies = nextState.enemies.filter((e: Actor) => e.id !== dying.id);
                } else if (hexEquals(nextState.player.position, targetPos)) {
                    nextState.dyingEntities = [...(nextState.dyingEntities || []), nextState.player];
                }
            }
            if (effect.effect === 'spearTrail' && effect.path) {
                nextState.lastSpearPath = effect.path;
            }
            break;
        }

        case 'ModifyCooldown': {
            if (nextState.player.activeSkills) {
                nextState.player.activeSkills = nextState.player.activeSkills.map(s => {
                    if (s.id === effect.skillId) {
                        let newCd = effect.setExact ? effect.amount : s.currentCooldown + effect.amount;
                        newCd = Math.max(0, newCd);
                        return { ...s, currentCooldown: newCd };
                    }
                    return s;
                });
            }
            break;
        }
    }

    return nextState;
};

/**
 * Apply multiple atomic effects in sequence.
 */
export const applyEffects = (state: GameState, effects: AtomicEffect[], context: { targetId?: string } = {}): GameState => {
    return effects.reduce((currState, effect) => applyAtomicEffect(currState, effect, context), state);
};
