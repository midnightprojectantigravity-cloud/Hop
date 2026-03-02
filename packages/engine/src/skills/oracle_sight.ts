import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';

export const ORACLE_SIGHT: SkillDefinition = {
    id: 'ORACLE_SIGHT',
    name: "Oracle's Sight",
    description: 'Reveal top enemy action utilities when provided by caller context.',
    slot: 'passive',
    icon: 'OS',
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
        information: [{
            domain: 'information',
            providerId: 'oracle_sight.utilities',
            priority: 30,
            resolve: (query) => ({
                decision: query.context?.topActionUtilities?.length ? 'allow' : 'neutral',
                reveal: {
                    topActionUtilities: true
                }
            })
        }]
    },
    upgrades: {}
};
