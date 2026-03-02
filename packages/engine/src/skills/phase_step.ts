import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const PHASE_STEP: SkillDefinition = {
    id: 'PHASE_STEP',
    name: 'Phase Step',
    description: 'Bend local space to move through walls.',
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
            providerId: 'phase_step.wall_phase',
            priority: 30,
            resolutionMode: 'EXTEND',
            resolve: (query) => {
                const trinity = extractTrinityStats(query.actor);
                const rangeModifier = clamp(Math.floor(trinity.mind / 12), 0, 2);
                return {
                    decision: 'allow',
                    resolutionMode: 'EXTEND',
                    model: {
                        ignoreWalls: true,
                        rangeModifier
                    }
                };
            }
        }]
    },
    upgrades: {}
};
