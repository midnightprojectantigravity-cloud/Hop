import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';

export const BURROW: SkillDefinition = {
    id: 'BURROW',
    name: 'Burrow',
    description: 'Extend movement to tunnel through walls and hazards.',
    slot: 'passive',
    icon: 'BU',
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
            providerId: 'burrow.movement',
            priority: 20,
            resolutionMode: 'EXTEND',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'EXTEND',
                model: {
                    ignoreGroundHazards: true,
                    ignoreWalls: true,
                    allowPassThroughActors: false,
                    rangeModifier: 0
                }
            })
        }]
    },
    upgrades: {}
};
