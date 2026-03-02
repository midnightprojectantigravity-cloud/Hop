import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';

export const BLIND_FIGHTING: SkillDefinition = {
    id: 'BLIND_FIGHTING',
    name: 'Blind Fighting',
    description: 'Mitigate unseen-target penalties in close combat.',
    slot: 'passive',
    icon: 'BF',
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
            providerId: 'blind_fighting.unseen_penalty',
            priority: 5,
            resolutionMode: 'EXTEND',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'EXTEND',
                model: {
                    unseenAttackPenaltyMultiplier: 0.5
                }
            })
        }]
    },
    upgrades: {}
};
