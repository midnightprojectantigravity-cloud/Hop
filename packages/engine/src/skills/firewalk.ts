import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange, isBlockedByActor } from '../systems/validation';
import { pointToKey } from '../hex';

/**
 * FIREWALK Skill
 * Teleport to fire or lava tiles.
 * Grants fire immunity for 2 turns.
 */
export const FIREWALK: SkillDefinition = {
    id: 'FIREWALK',
    name: 'Firewalk',
    description: 'Teleport to a fire or lava tile. Grants 2 turns of Fire Immunity.',
    slot: 'utility',
    icon: '🏃🔥',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 3,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (!validateRange(attacker.position, target, 4)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        const tile = state.tiles.get(pointToKey(target));
        const isFire = tile?.effects.some(e => e.id === 'FIRE');
        const isLava = tile?.baseId === 'LAVA' || tile?.traits.has('LIQUID');

        if (!isFire && !isLava) {
            return { effects, messages: ['Can only teleport to Fire or Lava!'], consumesTurn: false };
        }

        if (isBlockedByActor(state, target, attacker.id)) {
            return { effects, messages: ['Target position occupied!'], consumesTurn: false };
        }

        // Teleport
        effects.push({ type: 'Displacement', target: 'self', destination: target, source: attacker.position });

        // Grant Immunity
        effects.push({ type: 'ApplyStatus', target: 'self', status: 'fire_immunity', duration: 2 });

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#ff8800' });
        messages.push("Firewalk!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const targets: Point[] = [];
        state.tiles.forEach((tile) => {
            const dist = hexDistance(origin, tile.position);
            if (dist > 0 && dist <= 4) {
                const isFire = tile.effects.some(e => e.id === 'FIRE');
                const isLava = tile.baseId === 'LAVA' || tile.traits.has('LIQUID');
                if (isFire || isLava) {
                    targets.push(tile.position);
                }
            }
        });
        return targets;
    },
    upgrades: {},
    scenarios: getSkillScenarios('FIREWALK')
};
