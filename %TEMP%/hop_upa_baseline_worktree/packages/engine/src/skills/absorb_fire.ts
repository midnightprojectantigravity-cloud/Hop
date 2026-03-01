import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';

export const ABSORB_FIRE: SkillDefinition = {
    id: 'ABSORB_FIRE',
    name: 'Absorb Fire',
    description: 'Fire heals you instead of harming you.',
    slot: 'passive',
    icon: '🔥', // Or a green fire icon if available
    baseVariables: {
        cost: 0,
        cooldown: 0,
        range: 0
    },
    execute: (_state: GameState, _attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[] } => {
        // Passive skill, no active execution
        return { effects: [], messages: [] };
    },
    getValidTargets: () => [],
    upgrades: {}
};
