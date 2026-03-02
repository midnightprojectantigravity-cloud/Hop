import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { pointToKey } from '../hex';
import {
    resolveSkillMovementPolicy,
    validateMovementDestination
} from '../systems/capabilities/movement-policy';

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
        const movementPolicy = resolveSkillMovementPolicy(state, attacker, {
            skillId: 'FIREWALK',
            target,
            baseRange: 4,
            basePathing: 'teleport',
            baseIgnoreGroundHazards: true
        });

        if (!validateRange(attacker.position, target, movementPolicy.range)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        const tile = state.tiles.get(pointToKey(target));
        const isFire = tile?.effects.some(e => e.id === 'FIRE');
        const isLava = tile?.baseId === 'LAVA' || tile?.traits.has('LIQUID');

        if (!isFire && !isLava) {
            return { effects, messages: ['Can only teleport to Fire or Lava!'], consumesTurn: false };
        }

        const destination = validateMovementDestination(state, attacker, target, movementPolicy, {
            ignoreHazards: true
        });
        if (!destination.isValid) {
            return { effects, messages: ['Target position occupied!'], consumesTurn: false };
        }

        // Teleport movement should not process pass-through tiles.
        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            source: attacker.position,
            simulatePath: movementPolicy.simulatePath,
            ignoreGroundHazards: movementPolicy.ignoreGroundHazards
        });

        // Grant Immunity
        effects.push({ type: 'ApplyStatus', target: 'self', status: 'fire_immunity', duration: 2 });

        effects.push({
            type: 'Juice',
            effect: 'flash',
            target,
            color: '#ff8800',
            metadata: {
                signature: 'MOVE.BLINK.FIRE.FIREWALK',
                family: 'movement',
                primitive: 'blink',
                phase: 'impact',
                element: 'fire',
                variant: 'firewalk',
                targetRef: { kind: 'target_hex' },
                skillId: 'FIREWALK'
            }
        });
        messages.push("Firewalk!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const targets: Point[] = [];
        const actorAtOrigin = state.player.position.q === origin.q
            && state.player.position.r === origin.r
            && state.player.position.s === origin.s
            ? state.player
            : state.enemies.find(e => e.position.q === origin.q && e.position.r === origin.r && e.position.s === origin.s);
        const range = actorAtOrigin
            ? resolveSkillMovementPolicy(state, actorAtOrigin, {
                skillId: 'FIREWALK',
                baseRange: 4,
                basePathing: 'teleport',
                baseIgnoreGroundHazards: true
            }).range
            : 4;
        state.tiles.forEach((tile) => {
            const dist = hexDistance(origin, tile.position);
            if (dist > 0 && dist <= range) {
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
