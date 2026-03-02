import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';

export const FLIGHT: SkillDefinition = {
    id: 'FLIGHT',
    name: 'Flight',
    description: 'Replace walking movement with aerial traversal.',
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
            providerId: 'flight.movement',
            priority: 30,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'flight',
                    ignoreGroundHazards: true,
                    ignoreWalls: false,
                    allowPassThroughActors: false,
                    rangeModifier: 0
                }
            })
        }]
    },
    upgrades: {}
};
