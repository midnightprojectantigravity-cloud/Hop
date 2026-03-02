import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

export const TACTICAL_INSIGHT: SkillDefinition = {
    id: 'TACTICAL_INSIGHT',
    name: 'Tactical Insight',
    description: 'Reveal enemy intent badge with sufficient Instinct.',
    slot: 'passive',
    icon: 'TI',
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
            providerId: 'tactical_insight.intent',
            priority: 20,
            resolve: (query) => {
                const trinity = extractTrinityStats(query.viewer);
                if (trinity.instinct < 10) return { decision: 'neutral' };
                return {
                    decision: 'allow',
                    reveal: {
                        intentBadge: true
                    }
                };
            }
        }]
    },
    upgrades: {}
};
