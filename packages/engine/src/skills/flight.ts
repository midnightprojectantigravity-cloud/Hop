import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const FLIGHT: SkillDefinition = {
    id: 'FLIGHT',
    name: 'Flight',
    description: 'Replaces walking with aerial movement and ignores ground hazards.',
    slot: 'passive',
    icon: 'FL',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0
    },
    execute: (_state: GameState, _attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[] } => ({
        effects: [],
        messages: []
    }),
    getValidTargets: () => [],
    capabilities: {
        movement: [{
            domain: 'movement',
            providerId: 'flight.model',
            priority: 40,
            resolutionMode: 'REPLACE',
            resolve: (query) => {
                const trinity = extractTrinityStats(query.actor);
                const rangeModifier = clamp(Math.floor(trinity.instinct / 14), 0, 2);
                return {
                    decision: 'allow',
                    resolutionMode: 'REPLACE',
                    model: {
                        pathing: 'flight',
                        ignoreGroundHazards: true,
                        ignoreWalls: false,
                        allowPassThroughActors: false,
                        rangeModifier
                    }
                };
            }
        }]
    },
    upgrades: {}
};
