import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const computeEnemyAwarenessScore = (observer: Actor): number => {
    const trinity = extractTrinityStats(observer);
    return (0.060 * Math.max(0, trinity.instinct))
        + (0.025 * Math.max(0, trinity.mind))
        + (0.015 * Math.max(0, trinity.body));
};

export const computeEnemyAwarenessDetectRange = (observer: Actor): number => {
    const awarenessScore = computeEnemyAwarenessScore(observer);
    return clamp(3 + Math.floor(awarenessScore * 1.5), 4, 9);
};

export const computeEnemyButcherFactor = (observer: Actor): number => {
    const awarenessScore = computeEnemyAwarenessScore(observer);
    return clamp(1 + Math.floor(awarenessScore), 1, 4);
};

export const computeEnemyAwarenessMemoryTurns = (observer: Actor): number =>
    2 + computeEnemyButcherFactor(observer);

export const computeEnemyAwarenessSearchRadius = (observer: Actor): number =>
    1 + computeEnemyButcherFactor(observer);

export const ENEMY_AWARENESS: SkillDefinition = {
    id: 'ENEMY_AWARENESS',
    name: 'Enemy Awareness',
    description: 'Hostile perception package for detection, chase memory, and butcher pressure.',
    slot: 'passive',
    icon: 'EA',
    baseVariables: {
        range: 4,
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
            providerId: 'enemy_awareness.los',
            priority: 10,
            resolve: (query) => {
                if (query.observer.type !== 'enemy') {
                    return {
                        decision: 'neutral',
                        channelId: 'enemy_awareness'
                    };
                }

                const context = query.context || {};
                if (context.statusBlind === true || context.smokeBlind === true) {
                    return {
                        decision: 'block',
                        blockKind: 'hard',
                        reason: 'status_blind',
                        channelId: 'enemy_awareness',
                        maxRange: 0
                    };
                }

                const range = computeEnemyAwarenessDetectRange(query.observer);
                if (query.distance > range) {
                    return {
                        decision: 'neutral',
                        channelId: 'enemy_awareness',
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
                        channelId: 'enemy_awareness',
                        maxRange: range
                    };
                }

                return {
                    decision: 'block',
                    blockKind: 'soft',
                    reason: 'line_of_sight_blocked',
                    channelId: 'enemy_awareness',
                    maxRange: range
                };
            }
        }]
    },
    upgrades: {}
};

