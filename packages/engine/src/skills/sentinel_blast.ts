import type { SkillDefinition, Point, GameState, AtomicEffect, Actor } from '../types';
import { getNeighbors } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { getAreaTargets } from '../systems/navigation';

/**
 * SENTINEL_BLAST
 * The Sentinel's unique attack. A wide-area blast that is telegraphed.
 */
export const SENTINEL_BLAST: SkillDefinition = {
    id: 'SENTINEL_BLAST',
    name: 'Sentinel Blast',
    description: 'A massive energy surge from the Sentinel.',
    slot: 'offensive',
    icon: '💥',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 0,
        damage: 2
    },
    execute: (_state: GameState, _attacker: Actor, target?: Point) => {
        if (!target) return { effects: [], messages: [] };

        const effects: AtomicEffect[] = [
            { type: 'Damage', target: target, amount: 2 },
            { type: 'Juice', effect: 'shake', intensity: 'high' }
        ];

        // Also hit neighbors
        const neighbors = getNeighbors(target);
        neighbors.forEach(n => {
            effects.push({ type: 'Damage', target: n, amount: 1 });
        });

        return {
            effects,
            messages: ['The Sentinel unleashed a massive blast!'],
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const range = 3;
        return getAreaTargets(state, origin, range);
    },
    upgrades: {},
    scenarios: getSkillScenarios('SENTINEL_BLAST')
};
