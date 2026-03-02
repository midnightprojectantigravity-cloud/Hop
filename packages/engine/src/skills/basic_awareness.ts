import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';

export const BASIC_AWARENESS: SkillDefinition = {
    id: 'BASIC_AWARENESS',
    name: 'Basic Awareness',
    description: 'Reveal enemy identity and vitality.',
    slot: 'passive',
    icon: 'BA',
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
            providerId: 'basic_awareness.info',
            priority: 10,
            resolve: () => ({
                decision: 'allow',
                reveal: {
                    name: true,
                    hp: true
                }
            })
        }]
    },
    upgrades: {}
};
