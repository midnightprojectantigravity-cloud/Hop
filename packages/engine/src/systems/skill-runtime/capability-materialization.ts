import type {
    Actor,
    GameState,
    InformationProvider,
    InformationQuery,
    MovementProvider,
    MovementQuery,
    SenseProvider,
    SenseQuery,
    SkillCapabilities,
    SkillDefinition,
    SkillModifier
} from '../../types';
import { extractTrinityStats } from '../combat/combat-calculator';
import { hexEquals } from '../../hex';
import type { SkillRuntimeDefinition } from './types';

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

const getRuntimeSkillUpgradeSet = (actor: Actor, skillId: string): Set<string> => {
    const activeSkill = actor.activeSkills?.find(skill => skill.id === skillId);
    return new Set(activeSkill?.activeUpgrades || []);
};

const computeStandardVisionRange = (observer: Actor, definition: SkillRuntimeDefinition): number => {
    const provider = definition.capabilities?.senses?.find(candidate => candidate.kind === 'standard_vision_los_v1');
    if (!provider) return 0;
    const trinity = extractTrinityStats(observer);
    const statPool = Math.max(0, trinity.body) + Math.max(0, trinity.mind) + Math.max(0, trinity.instinct);
    const upgrades = getRuntimeSkillUpgradeSet(observer, definition.id);
    const tier = 1
        + (upgrades.has('VISION_TIER_2') ? 1 : 0)
        + (upgrades.has('VISION_TIER_3') ? 1 : 0)
        + (upgrades.has('VISION_TIER_4') ? 1 : 0);
    return clamp(provider.range.base + tier + Math.floor(statPool / 100), provider.range.minimum, provider.range.maximum);
};

const computeEnemyAwarenessRange = (observer: Actor, definition: SkillRuntimeDefinition): number => {
    const provider = definition.capabilities?.senses?.find(candidate => candidate.kind === 'enemy_awareness_los_v1');
    if (!provider) return 0;
    const trinity = extractTrinityStats(observer);
    const awarenessScore = (0.060 * Math.max(0, trinity.instinct))
        + (0.025 * Math.max(0, trinity.mind))
        + (0.015 * Math.max(0, trinity.body));
    return clamp(provider.range.base + Math.floor(awarenessScore * 1.5), provider.range.minimum, provider.range.maximum);
};

const computeVibrationSenseRange = (observer: Actor, definition: SkillRuntimeDefinition): number => {
    const provider = definition.capabilities?.senses?.find(candidate => candidate.kind === 'vibration_sense_motion_v1');
    if (!provider) return 0;
    const trinity = extractTrinityStats(observer);
    return clamp(provider.range.base + Math.floor(trinity.instinct / 8), provider.range.minimum, provider.range.maximum);
};

export const materializeSkillDefinitionCapabilityProviders = (definition: SkillRuntimeDefinition): SkillCapabilities | undefined => {
    const capabilities = definition.capabilities;
    if (!capabilities) return undefined;

    const senses: SenseProvider[] = [];
    const information: InformationProvider[] = [];
    const movement: MovementProvider[] = [];

    for (const provider of capabilities.information || []) {
        information.push({
            domain: 'information',
            providerId: provider.providerId,
            priority: provider.priority,
            resolve: (query: InformationQuery) => {
                switch (provider.kind) {
                    case 'basic_reveal_v1':
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    case 'combat_analysis_v1': {
                        const viewerStats = extractTrinityStats(query.viewer);
                        if (viewerStats.mind < (provider.minViewerStat?.minimum ?? 10)) {
                            return { decision: 'neutral' };
                        }
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    }
                    case 'tactical_insight_v1': {
                        const viewerStats = extractTrinityStats(query.viewer);
                        if (viewerStats.instinct < (provider.minViewerStat?.minimum ?? 10)) {
                            return { decision: 'neutral' };
                        }
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    }
                    case 'oracle_sight_v1':
                        if (!query.context?.topActionUtilities?.length) {
                            return { decision: 'neutral' };
                        }
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    default:
                        return { decision: 'neutral' };
                }
            }
        });
    }

    for (const provider of capabilities.senses || []) {
        senses.push({
            domain: 'senses',
            providerId: provider.providerId,
            priority: provider.priority,
            resolve: (query: SenseQuery) => {
                switch (provider.kind) {
                    case 'standard_vision_los_v1': {
                        const context = query.context || {};
                        if (context.statusBlind === true || context.smokeBlind === true) {
                            return {
                                decision: 'block',
                                blockKind: 'hard',
                                reason: 'status_blind',
                                channelId: provider.channelId,
                                maxRange: 0
                            };
                        }
                        const range = computeStandardVisionRange(query.observer, definition);
                        if (query.distance > range) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
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
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        return {
                            decision: 'block',
                            blockKind: 'soft',
                            reason: 'line_of_sight_blocked',
                            channelId: provider.channelId,
                            maxRange: range
                        };
                    }
                    case 'enemy_awareness_los_v1': {
                        if (query.observer.type !== 'enemy') {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId
                            };
                        }
                        const context = query.context || {};
                        if (context.statusBlind === true || context.smokeBlind === true) {
                            return {
                                decision: 'block',
                                blockKind: 'hard',
                                reason: 'status_blind',
                                channelId: provider.channelId,
                                maxRange: 0
                            };
                        }
                        const range = computeEnemyAwarenessRange(query.observer, definition);
                        if (query.distance > range) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
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
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        return {
                            decision: 'block',
                            blockKind: 'soft',
                            reason: 'line_of_sight_blocked',
                            channelId: provider.channelId,
                            maxRange: range
                        };
                    }
                    case 'vibration_sense_motion_v1': {
                        const range = computeVibrationSenseRange(query.observer, definition);
                        if (query.distance > range) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        const targetActor = query.targetActor;
                        const movedLastTurn = Boolean(
                            targetActor
                            && targetActor.previousPosition
                            && !hexEquals(targetActor.previousPosition, targetActor.position)
                        );
                        if (!movedLastTurn) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        return {
                            decision: 'allow',
                            channelId: provider.channelId,
                            maxRange: range
                        };
                    }
                    default:
                        return { decision: 'neutral', channelId: provider.channelId };
                }
            }
        });
    }

    for (const provider of capabilities.movement || []) {
        movement.push({
            domain: 'movement',
            providerId: provider.providerId,
            priority: provider.priority,
            resolutionMode: provider.resolutionMode,
            resolve: (_query: MovementQuery) => {
                switch (provider.kind) {
                    case 'flight_replace_v1':
                    case 'phase_step_replace_v1':
                    case 'burrow_extend_v1':
                    case 'blind_fighting_unseen_penalty_v1':
                        return {
                            decision: 'allow',
                            resolutionMode: provider.resolutionMode,
                            model: { ...provider.model }
                        };
                    default:
                        return {
                            decision: 'neutral',
                            resolutionMode: provider.resolutionMode
                        };
                }
            }
        });
    }

    if (senses.length === 0 && information.length === 0 && movement.length === 0) return undefined;
    return {
        senses,
        information,
        movement
    };
};
