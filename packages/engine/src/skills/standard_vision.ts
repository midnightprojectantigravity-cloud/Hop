import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const getVisionTier = (observer: Actor): number => {
    const visionSkill = observer.activeSkills?.find(skill => skill.id === 'STANDARD_VISION');
    const activeUpgrades = new Set(visionSkill?.activeUpgrades || []);
    return 1
        + (activeUpgrades.has('VISION_TIER_2') ? 1 : 0)
        + (activeUpgrades.has('VISION_TIER_3') ? 1 : 0)
        + (activeUpgrades.has('VISION_TIER_4') ? 1 : 0);
};

export const computeStandardVisionRange = (observer: Actor): number => {
    const trinity = extractTrinityStats(observer);
    const statPool = Math.max(0, trinity.body) + Math.max(0, trinity.mind) + Math.max(0, trinity.instinct);
    const tier = getVisionTier(observer);
    return clamp(3 + tier + Math.floor(statPool / 100), 3, 11);
};

export const STANDARD_VISION: SkillDefinition = {
    id: 'STANDARD_VISION',
    name: 'Standard Vision',
    description: 'Visual line-of-sight for fog reveal. Range scales by vision tier and total core stats.',
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
                const context = query.context || {};
                if (context.statusBlind === true || context.smokeBlind === true) {
                    return {
                        decision: 'block',
                        blockKind: 'hard',
                        reason: 'status_blind',
                        channelId: 'standard_vision',
                        maxRange: 0
                    };
                }
                const range = computeStandardVisionRange(query.observer);
                if (query.distance > range) {
                    return {
                        decision: 'neutral',
                        channelId: 'standard_vision',
                        maxRange: range
                    };
                }
                const los = query.evaluateFallbackLineOfSight({
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
    upgrades: {
        VISION_TIER_2: {
            id: 'VISION_TIER_2',
            name: 'Vision Tier II',
            description: 'Increase visual tier by 1.'
        },
        VISION_TIER_3: {
            id: 'VISION_TIER_3',
            name: 'Vision Tier III',
            description: 'Increase visual tier by 1.'
        },
        VISION_TIER_4: {
            id: 'VISION_TIER_4',
            name: 'Vision Tier IV',
            description: 'Increase visual tier by 1.'
        }
    }
};
