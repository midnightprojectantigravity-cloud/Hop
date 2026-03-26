import type { Point, SkillDefinition } from '../types';

export const VOLATILE_PAYLOAD: SkillDefinition = {
    id: 'VOLATILE_PAYLOAD',
    name: 'Volatile Payload',
    description: 'Any positive damage detonates the bomb immediately.',
    slot: 'passive',
    icon: '💥',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0,
        damage: 0,
    },
    execute: () => ({
        effects: [],
        messages: [],
        consumesTurn: false
    }),
    getValidTargets: (_state, origin: Point) => [origin],
    upgrades: {},
};
