import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { getSkillScenarios } from '../scenarios';
import { SpatialSystem } from '../systems/SpatialSystem';

/**
 * SENTINEL_TELEGRAPH
 * Turn 1 of the Sentinel playlist: marks the incoming blast zone.
 */
export const SENTINEL_TELEGRAPH: SkillDefinition = {
    id: 'SENTINEL_TELEGRAPH',
    name: 'Sentinel Telegraph',
    description: 'The Sentinel marks an impact zone for a delayed blast.',
    slot: 'offensive',
    icon: '⚠',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 0
    },
    execute: (_state: GameState, _attacker: Actor, target?: Point) => {
        if (!target) return { effects: [], messages: [], consumesTurn: true };

        const effects: AtomicEffect[] = [
            { type: 'Juice', effect: 'combat_text', target, text: 'TELEGRAPH' }
        ];

        return {
            effects,
            messages: ['The Sentinel marks the impact zone.'],
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return SpatialSystem.getAreaTargets(state, origin, 3);
    },
    upgrades: {},
    scenarios: getSkillScenarios('SENTINEL_TELEGRAPH')
};

