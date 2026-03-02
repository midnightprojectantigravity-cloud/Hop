import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const BURROW: SkillDefinition = {
    id: 'BURROW',
    name: 'Burrow',
    description: 'Shift below the surface to slip through occupied lanes.',
    slot: 'passive',
    icon: 'BR',
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
            providerId: 'burrow.pass_through',
            priority: 20,
            resolutionMode: 'EXTEND',
            resolve: (query) => {
                const trinity = extractTrinityStats(query.actor);
                const rangeModifier = clamp(Math.floor(trinity.body / 16), 0, 1);
                return {
                    decision: 'allow',
                    resolutionMode: 'EXTEND',
                    model: {
                        allowPassThroughActors: true,
                        rangeModifier
                    }
                };
            }
        }]
    },
    upgrades: {}
};
