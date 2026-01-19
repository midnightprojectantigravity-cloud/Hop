import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getReachableHexes } from '../systems/navigation';
import { processKineticRequest } from '../systems/movement';
import { hexEquals, hexDistance, getDirectionFromTo } from '../hex';
import { getActorAt } from '../helpers';

/**
 * KINETIC DASH Skill
 * 
 * A momentum-based dash that uses the Kinetic Pulse physics system.
 */
export const DASH: SkillDefinition = {
    id: 'DASH',
    name: 'Kinetic Dash',
    description: 'Dash in a straight line. With a shield, slam into enemies and send them flying!',
    slot: 'passive',
    icon: '💨',
    baseVariables: {
        range: 4,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const dist = hexDistance(attacker.position, target);
        const dirIdx = getDirectionFromTo(attacker.position, target);

        const noEnemies = state.enemies.filter(e => e.hp > 0).length === 0;
        const maxDist = noEnemies ? 20 : 4;

        if (dist < 1 || dist > maxDist) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }
        if (dirIdx === -1) {
            return { effects, messages: ['Axial only! Dash must be in a straight line.'], consumesTurn: false };
        }

        const targetActor = getActorAt(state, target);

        // Check for immediate wall blockage along the path
        const reachable = getReachableHexes(state, attacker.position, { range: 4, axialOnly: true, stopAtObstacles: true });
        if (!reachable.some(r => hexEquals(r, target))) {
            return { effects, messages: ['Path blocked by wall!'], consumesTurn: false };
        }

        // Simple Dash if target is empty
        if (!targetActor) {
            effects.push({ type: 'Displacement', target: 'self', destination: target });
            effects.push({ type: 'Juice', effect: 'impact', target: target, intensity: 'low' });
            return { effects, messages: [noEnemies ? 'Free Dash!' : 'Dashed!'], consumesTurn: !noEnemies };
        }

        if (!state.hasShield) {
            return { effects, messages: ['Target occupied! Need shield to shunt enemies.'], consumesTurn: false };
        }

        // ─────────────────────────────────────────────────────────────────
        // PHYSICS RESOLUTION RELAY
        // ─────────────────────────────────────────────────────────────────
        const momentum = 4;
        const result = processKineticRequest(state, {
            sourceId: attacker.id,
            target,
            momentum
        });

        const shuntMessage = 'Shield Shunt triggered!';

        return {
            effects: [...effects, ...result.effects],
            messages: [...messages, ...result.messages, shuntMessage],
            consumesTurn: true
        };
    },

    getValidTargets: (state: GameState, origin: Point) => {
        const noEnemies = state.enemies.filter(e => e.hp > 0).length === 0;
        const range = noEnemies ? 20 : 4;

        return getReachableHexes(state, origin, {
            range,
            axialOnly: true,
            stopAtObstacles: true
        });
    },

    upgrades: {
        'MOMENTUM_SURGE': {
            id: 'MOMENTUM_SURGE',
            name: 'Momentum Surge',
            description: '+2 Momentum when dashing with shield',
        },
        'CHAIN_REACTION': {
            id: 'CHAIN_REACTION',
            name: 'Chain Reaction',
            description: 'Enemies pushed into other enemies transfer momentum',
        }
    },
    scenarios: []
};

