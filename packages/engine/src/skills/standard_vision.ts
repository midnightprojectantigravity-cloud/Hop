import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const STANDARD_VISION: SkillDefinition = {
    id: 'STANDARD_VISION',
    name: 'Standard Vision',
    description: 'Baseline visual line-of-sight governed by Mind.',
    slot: 'passive',
    icon: 'SV',
    baseVariables: {
        range: 3,
        cost: 0,
        cooldown: 0
    },
    execute: (_state: GameState, _attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[] } => ({
        effects: [],
        messages: []
    }),
    getValidTargets: () => [],
    capabilities: {
        senses: [{
            domain: 'senses',
            providerId: 'standard_vision.los',
            priority: 10,
            resolve: (query) => {
                const trinity = extractTrinityStats(query.observer);
                const range = clamp(3 + Math.floor(trinity.mind / 5), 3, 8);
                if (query.distance > range) {
                    return {
                        decision: 'neutral',
                        channelId: 'standard_vision',
                        maxRange: range
                    };
                }
                const los = query.evaluateLegacyLineOfSight({
                    stopAtWalls: query.stopAtWalls,
                    stopAtActors: query.stopAtActors,
                    stopAtLava: query.stopAtLava,
                    excludeActorId: query.excludeActorId
                });
                if (los.isValid) {
                    return {
                        decision: 'allow',
                        channelId: 'standard_vision',
                        maxRange: range
                    };
                }
                return {
                    decision: 'block',
                    blockKind: 'soft',
                    reason: 'line_of_sight_blocked',
                    channelId: 'standard_vision',
                    maxRange: range
                };
            }
        }]
    },
    upgrades: {}
};
