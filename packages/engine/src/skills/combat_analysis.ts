import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

export const COMBAT_ANALYSIS: SkillDefinition = {
    id: 'COMBAT_ANALYSIS',
    name: 'Combat Analysis',
    description: 'Reveal enemy trinity stats with sufficient Mind.',
    slot: 'passive',
    icon: 'CA',
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
            providerId: 'combat_analysis.stats',
            priority: 20,
            resolve: (query) => {
                const trinity = extractTrinityStats(query.viewer);
                if (trinity.mind < 10) return { decision: 'neutral' };
                return {
                    decision: 'allow',
                    reveal: {
                        trinityStats: true
                    }
                };
            }
        }]
    },
    upgrades: {}
};
