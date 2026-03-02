import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';

export const PHASE_STEP: SkillDefinition = {
    id: 'PHASE_STEP',
    name: 'Phase Step',
    description: 'Replace movement with short-range phasing teleports.',
    slot: 'passive',
    icon: 'PS',
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
            providerId: 'phase_step.movement',
            priority: 35,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'teleport',
                    ignoreGroundHazards: true,
                    ignoreWalls: true,
                    allowPassThroughActors: true,
                    rangeModifier: -1
                }
            })
        }]
    },
    upgrades: {}
};
