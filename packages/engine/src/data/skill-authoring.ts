import type {
    CombatScriptInstruction,
    RuntimePointFilter,
    RuntimePointPattern,
    RuntimePointSet,
    SkillAuthoringDefinition,
    SkillTargetPredicate
} from '../systems/skill-runtime/types';
import { ContractValidationError } from './contract-parser';

export interface SkillAuthoringValidationIssue {
    path: string;
    message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const push = (issues: SkillAuthoringValidationIssue[], path: string, message: string): void => {
    issues.push({ path, message });
};

const parseJsonLike = (input: unknown): unknown => {
    if (!isString(input)) return input;
    try {
        return JSON.parse(input);
    } catch (error) {
        throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }
};

const VALID_SORTS = new Set(['distance_then_q_then_r', 'q_then_r', 'r_then_q']);
const VALID_GENERATORS = new Set(['self', 'owner_hex', 'single', 'radius', 'axial_ray', 'diagonal_landing', 'movement_reachable', 'anchor_point']);
const VALID_PHASES = new Set(['declare', 'movement', 'collision', 'resolution', 'cleanup']);
const VALID_KINDS = new Set([
    'MOVE_ACTOR',
    'TELEPORT_ACTOR',
    'APPLY_FORCE',
    'EMIT_PULSE',
    'TRACE_PROJECTILE',
    'RESOLVE_COLLISION',
    'DEAL_DAMAGE',
    'APPLY_STATUS',
    'HEAL',
    'APPLY_AILMENT',
    'SET_STEALTH',
    'PLACE_SURFACE',
    'SPAWN_ACTOR',
    'SPAWN_ITEM',
    'PICKUP_ITEM',
    'MODIFY_COOLDOWN',
    'MODIFY_RESOURCE',
    'REMOVE_CORPSE',
    'PLACE_TRAP',
    'REMOVE_TRAP',
    'SET_TRAP_COOLDOWN',
    'UPDATE_COMPANION_STATE',
    'UPDATE_BEHAVIOR_STATE',
    'EMIT_JUICE',
    'MESSAGE'
]);
const VALID_SLOTS = new Set(['offensive', 'defensive', 'utility', 'passive']);
const VALID_POINT_FILTERS = new Set<RuntimePointFilter>(['skip_blocked_by_wall']);
const VALID_POINT_PATTERN_SHORTHANDS = new Set([
    'selected_hex_only',
    'selected_hex_plus_neighbors',
    'selected_neighbors_only'
]);
const VALID_PATH_REFS = new Set([
    'caster_to_selected',
    'caster_to_impact',
    'impact_to_target_actor',
    'spear_to_caster',
    'shield_to_caster'
]);

const validatePointSet = (
    value: unknown,
    issues: SkillAuthoringValidationIssue[],
    path: string
): value is RuntimePointSet => {
    if (!isRecord(value)) {
        push(issues, path, 'Expected pointSet object');
        return false;
    }
    if (value.kind === 'axial_ring') {
        if (!isString(value.center) || value.center.length === 0) push(issues, `${path}.center`, 'Expected point ref');
        if (!isNumber(value.radius) || value.radius < 0) push(issues, `${path}.radius`, 'Expected non-negative number');
        if (value.cacheKey !== undefined && (!isString(value.cacheKey) || value.cacheKey.length === 0)) push(issues, `${path}.cacheKey`, 'Expected non-empty cache key');
        if (value.predicates !== undefined) {
            if (!Array.isArray(value.predicates)) {
                push(issues, `${path}.predicates`, 'Expected array');
            } else {
                value.predicates.forEach((predicate, index) => validatePredicate(predicate, issues, `${path}.predicates[${index}]`));
            }
        }
        if (value.selection !== undefined) {
            if (!isRecord(value.selection)) {
                push(issues, `${path}.selection`, 'Expected object');
            } else {
                if (!isString(value.selection.mode) || !new Set(['all', 'first_n', 'sample_without_replacement']).has(value.selection.mode)) {
                    push(issues, `${path}.selection.mode`, 'Expected all|first_n|sample_without_replacement');
                }
                if (value.selection.count !== undefined && (!isNumber(value.selection.count) || value.selection.count < 0)) {
                    push(issues, `${path}.selection.count`, 'Expected non-negative number');
                }
            }
        }
        return true;
    }
    if (value.kind === 'line_between') {
        if (!isString(value.from) || value.from.length === 0) push(issues, `${path}.from`, 'Expected point ref');
        if (!isString(value.to) || value.to.length === 0) push(issues, `${path}.to`, 'Expected point ref');
        if (value.cacheKey !== undefined && (!isString(value.cacheKey) || value.cacheKey.length === 0)) push(issues, `${path}.cacheKey`, 'Expected non-empty cache key');
        if (value.includeStart !== undefined && typeof value.includeStart !== 'boolean') push(issues, `${path}.includeStart`, 'Expected boolean');
        if (value.includeEnd !== undefined && typeof value.includeEnd !== 'boolean') push(issues, `${path}.includeEnd`, 'Expected boolean');
        return true;
    }

    push(issues, `${path}.kind`, 'Expected axial_ring|line_between');
    return false;
};

const validatePointPattern = (
    value: unknown,
    issues: SkillAuthoringValidationIssue[],
    path: string
): value is RuntimePointPattern => {
    if (isString(value)) {
        if (!VALID_POINT_PATTERN_SHORTHANDS.has(value)) {
            push(issues, path, 'Expected selected_hex_only|selected_hex_plus_neighbors|selected_neighbors_only');
            return false;
        }
        return true;
    }

    if (!isRecord(value)) {
        push(issues, path, 'Expected point pattern string or object');
        return false;
    }

    if (value.kind !== 'perpendicular_line') {
        push(issues, `${path}.kind`, 'Expected perpendicular_line');
        return false;
    }
    if (value.center !== 'selected_hex') {
        push(issues, `${path}.center`, 'Expected selected_hex');
    }
    if (value.relativeTo !== 'caster_to_selected') {
        push(issues, `${path}.relativeTo`, 'Expected caster_to_selected');
    }
    if (!isNumber(value.totalLength) || value.totalLength < 1 || !Number.isInteger(value.totalLength) || value.totalLength % 2 === 0) {
        push(issues, `${path}.totalLength`, 'Expected positive odd integer');
    }
    return true;
};

const validatePointFilters = (
    value: unknown,
    issues: SkillAuthoringValidationIssue[],
    path: string
): value is RuntimePointFilter[] => {
    if (!Array.isArray(value)) {
        push(issues, path, 'Expected array');
        return false;
    }
    value.forEach((filter, index) => {
        if (!isString(filter) || !VALID_POINT_FILTERS.has(filter as RuntimePointFilter)) {
            push(issues, `${path}[${index}]`, 'Expected supported point filter');
        }
    });
    return true;
};

const validateCapabilities = (
    value: unknown,
    issues: SkillAuthoringValidationIssue[],
    path: string
): boolean => {
    if (!isRecord(value)) {
        push(issues, path, 'Expected object');
        return false;
    }

    const validateBase = (provider: unknown, providerPath: string): provider is Record<string, unknown> => {
        if (!isRecord(provider)) {
            push(issues, providerPath, 'Expected object');
            return false;
        }
        if (!isString(provider.providerId) || provider.providerId.length === 0) {
            push(issues, `${providerPath}.providerId`, 'Expected non-empty provider id');
        }
        if (!isNumber(provider.priority)) {
            push(issues, `${providerPath}.priority`, 'Expected number');
        }
        return true;
    };

    if (value.information !== undefined) {
        if (!Array.isArray(value.information)) {
            push(issues, `${path}.information`, 'Expected array');
        } else {
            value.information.forEach((provider, index) => {
                const providerPath = `${path}.information[${index}]`;
                if (!validateBase(provider, providerPath)) return;
                if (!isString(provider.domain) || provider.domain !== 'information') {
                    push(issues, `${providerPath}.domain`, 'Expected information');
                }
                if (!isString(provider.kind) || !new Set(['basic_reveal_v1', 'combat_analysis_v1', 'tactical_insight_v1', 'oracle_sight_v1']).has(provider.kind)) {
                    push(issues, `${providerPath}.kind`, 'Expected supported information provider kind');
                }
                if (!isRecord(provider.reveal)) {
                    push(issues, `${providerPath}.reveal`, 'Expected object');
                }
                if (provider.minViewerStat !== undefined) {
                    if (!isRecord(provider.minViewerStat)) {
                        push(issues, `${providerPath}.minViewerStat`, 'Expected object');
                    } else {
                        if (!new Set(['body', 'mind', 'instinct']).has(String(provider.minViewerStat.stat))) {
                            push(issues, `${providerPath}.minViewerStat.stat`, 'Expected body|mind|instinct');
                        }
                        if (!isNumber(provider.minViewerStat.minimum)) {
                            push(issues, `${providerPath}.minViewerStat.minimum`, 'Expected number');
                        }
                    }
                }
                if (provider.requireTopActionUtilities !== undefined && typeof provider.requireTopActionUtilities !== 'boolean') {
                    push(issues, `${providerPath}.requireTopActionUtilities`, 'Expected boolean');
                }
            });
        }
    }

    if (value.senses !== undefined) {
        if (!Array.isArray(value.senses)) {
            push(issues, `${path}.senses`, 'Expected array');
        } else {
            value.senses.forEach((provider, index) => {
                const providerPath = `${path}.senses[${index}]`;
                if (!validateBase(provider, providerPath)) return;
                if (!isString(provider.domain) || provider.domain !== 'senses') {
                    push(issues, `${providerPath}.domain`, 'Expected senses');
                }
                if (!isString(provider.kind) || !new Set(['standard_vision_los_v1', 'enemy_awareness_los_v1', 'vibration_sense_motion_v1']).has(provider.kind)) {
                    push(issues, `${providerPath}.kind`, 'Expected supported senses provider kind');
                }
                if (!isString(provider.channelId) || provider.channelId.length === 0) {
                    push(issues, `${providerPath}.channelId`, 'Expected non-empty channel id');
                }
                if (!isRecord(provider.range)) {
                    push(issues, `${providerPath}.range`, 'Expected object');
                } else {
                    if (!isNumber(provider.range.base)) push(issues, `${providerPath}.range.base`, 'Expected number');
                    if (!isNumber(provider.range.minimum)) push(issues, `${providerPath}.range.minimum`, 'Expected number');
                    if (!isNumber(provider.range.maximum)) push(issues, `${providerPath}.range.maximum`, 'Expected number');
                    if (provider.range.stat !== undefined && !new Set(['body', 'mind', 'instinct']).has(String(provider.range.stat))) {
                        push(issues, `${providerPath}.range.stat`, 'Expected body|mind|instinct');
                    }
                    if (provider.range.divisor !== undefined && !isNumber(provider.range.divisor)) {
                        push(issues, `${providerPath}.range.divisor`, 'Expected number');
                    }
                    if (provider.range.addVisionTier !== undefined && typeof provider.range.addVisionTier !== 'boolean') {
                        push(issues, `${providerPath}.range.addVisionTier`, 'Expected boolean');
                    }
                }
                if (provider.requireEnemyObserver !== undefined && typeof provider.requireEnemyObserver !== 'boolean') {
                    push(issues, `${providerPath}.requireEnemyObserver`, 'Expected boolean');
                }
                if (provider.hardBlockWhenBlind !== undefined && typeof provider.hardBlockWhenBlind !== 'boolean') {
                    push(issues, `${providerPath}.hardBlockWhenBlind`, 'Expected boolean');
                }
                if (provider.useLegacyLineOfSight !== undefined && typeof provider.useLegacyLineOfSight !== 'boolean') {
                    push(issues, `${providerPath}.useLegacyLineOfSight`, 'Expected boolean');
                }
            });
        }
    }

    if (value.movement !== undefined) {
        if (!Array.isArray(value.movement)) {
            push(issues, `${path}.movement`, 'Expected array');
        } else {
            value.movement.forEach((provider, index) => {
                const providerPath = `${path}.movement[${index}]`;
                if (!validateBase(provider, providerPath)) return;
                if (!isString(provider.domain) || provider.domain !== 'movement') {
                    push(issues, `${providerPath}.domain`, 'Expected movement');
                }
                if (!isString(provider.kind) || !new Set(['flight_replace_v1', 'burrow_extend_v1', 'phase_step_replace_v1', 'blind_fighting_unseen_penalty_v1']).has(provider.kind)) {
                    push(issues, `${providerPath}.kind`, 'Expected supported movement provider kind');
                }
                if (!isString(provider.resolutionMode) || !new Set(['EXTEND', 'REPLACE']).has(provider.resolutionMode)) {
                    push(issues, `${providerPath}.resolutionMode`, 'Expected EXTEND|REPLACE');
                }
                if (!isRecord(provider.model)) {
                    push(issues, `${providerPath}.model`, 'Expected object');
                } else {
                    if (provider.model.pathing !== undefined && !new Set(['walk', 'flight', 'teleport']).has(String(provider.model.pathing))) {
                        push(issues, `${providerPath}.model.pathing`, 'Expected walk|flight|teleport');
                    }
                    if (provider.model.ignoreGroundHazards !== undefined && typeof provider.model.ignoreGroundHazards !== 'boolean') {
                        push(issues, `${providerPath}.model.ignoreGroundHazards`, 'Expected boolean');
                    }
                    if (provider.model.ignoreWalls !== undefined && typeof provider.model.ignoreWalls !== 'boolean') {
                        push(issues, `${providerPath}.model.ignoreWalls`, 'Expected boolean');
                    }
                    if (provider.model.allowPassThroughActors !== undefined && typeof provider.model.allowPassThroughActors !== 'boolean') {
                        push(issues, `${providerPath}.model.allowPassThroughActors`, 'Expected boolean');
                    }
                    if (provider.model.rangeModifier !== undefined && !isNumber(provider.model.rangeModifier)) {
                        push(issues, `${providerPath}.model.rangeModifier`, 'Expected number');
                    }
                    if (provider.model.unseenAttackPenaltyMultiplier !== undefined && !isNumber(provider.model.unseenAttackPenaltyMultiplier)) {
                        push(issues, `${providerPath}.model.unseenAttackPenaltyMultiplier`, 'Expected number');
                    }
                }
            });
        }
    }

    return true;
};

const validatePredicate = (value: unknown, issues: SkillAuthoringValidationIssue[], path: string): value is SkillTargetPredicate => {
    if (!isRecord(value)) {
        push(issues, path, 'Expected object');
        return false;
    }
    if (!isString(value.type) || value.type.length === 0) {
        push(issues, `${path}.type`, 'Expected predicate type');
        return false;
    }

    switch (value.type) {
        case 'ALL':
        case 'ANY':
            if (!Array.isArray(value.predicates) || value.predicates.length === 0) {
                push(issues, `${path}.predicates`, 'Expected non-empty predicate array');
                return false;
            }
            value.predicates.forEach((predicate, index) => validatePredicate(predicate, issues, `${path}.predicates[${index}]`));
            return true;
        case 'NOT':
            if (value.predicate === undefined) {
                push(issues, `${path}.predicate`, 'Expected nested predicate');
                return false;
            }
            validatePredicate(value.predicate, issues, `${path}.predicate`);
            return true;
        case 'WORLD_STATE':
            if (!isString(value.key) || !new Set(['has_spear', 'has_shield', 'spear_position_present', 'shield_position_present']).has(value.key)) {
                push(issues, `${path}.key`, 'Expected supported world-state key');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'PROJECTILE_IMPACT':
            if (!isString(value.kind) || !new Set(['wall', 'actor', 'empty']).has(value.kind)) {
                push(issues, `${path}.kind`, 'Expected wall|actor|empty');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'RESOLVED_KEYWORD':
            if (!isString(value.keyword) || value.keyword.length === 0) push(issues, `${path}.keyword`, 'Expected non-empty keyword');
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'HEX_TRAIT':
            if (!isString(value.trait) || value.trait.length === 0) push(issues, `${path}.trait`, 'Expected non-empty trait');
            return true;
        case 'TILE_EFFECT':
            if (!isString(value.effectId) || value.effectId.length === 0) push(issues, `${path}.effectId`, 'Expected non-empty tile effect id');
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'OCCUPANCY':
            if (typeof value.occupied !== 'boolean') push(issues, `${path}.occupied`, 'Expected boolean');
            return true;
        case 'CORPSE_PRESENT':
        case 'LINE_OF_SIGHT':
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'AXIAL_ALIGNMENT':
            if (!isString(value.axis) || !new Set(['Q', 'R', 'S', 'ANY']).has(value.axis)) {
                push(issues, `${path}.axis`, 'Expected Q|R|S|ANY');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'DISTANCE':
            if (!isString(value.op) || !new Set(['eq', 'lte', 'gte']).has(value.op)) push(issues, `${path}.op`, 'Expected eq|lte|gte');
            if (!isNumber(value.value)) push(issues, `${path}.value`, 'Expected number');
            return true;
        case 'STATUS':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) push(issues, `${path}.target`, 'Expected caster|target_actor');
            if (!isString(value.statusId) || value.statusId.length === 0) push(issues, `${path}.statusId`, 'Expected non-empty status id');
            return true;
        case 'STATUS_DURATION':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) push(issues, `${path}.target`, 'Expected caster|target_actor');
            if (!isString(value.statusId) || value.statusId.length === 0) push(issues, `${path}.statusId`, 'Expected non-empty status id');
            if (!isString(value.op) || !new Set(['eq', 'lte', 'gte']).has(value.op)) push(issues, `${path}.op`, 'Expected eq|lte|gte');
            if (!isNumber(value.value)) push(issues, `${path}.value`, 'Expected number');
            return true;
        case 'RESOURCE':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) push(issues, `${path}.target`, 'Expected caster|target_actor');
            if (!isString(value.resource) || !new Set(['hp', 'spark', 'mana', 'exhaustion']).has(value.resource)) push(issues, `${path}.resource`, 'Expected hp|spark|mana|exhaustion');
            if (!isString(value.op) || !new Set(['eq', 'lte', 'gte']).has(value.op)) push(issues, `${path}.op`, 'Expected eq|lte|gte');
            if (!isNumber(value.value)) push(issues, `${path}.value`, 'Expected number');
            return true;
        case 'TURN_STATE':
            if (!isString(value.kind) || !new Set(['held_position', 'moved_distance']).has(value.kind)) push(issues, `${path}.kind`, 'Expected held_position|moved_distance');
            if (value.op !== undefined && (!isString(value.op) || !new Set(['eq', 'lte', 'gte']).has(value.op))) push(issues, `${path}.op`, 'Expected eq|lte|gte');
            if (value.value !== undefined && !isNumber(value.value)) push(issues, `${path}.value`, 'Expected number');
            return true;
        case 'WEIGHT_CLASS':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) push(issues, `${path}.target`, 'Expected caster|target_actor');
            if (!isString(value.op) || !new Set(['eq', 'neq', 'in']).has(value.op)) push(issues, `${path}.op`, 'Expected eq|neq|in');
            return true;
        case 'FACTION_RELATION':
            if (!isString(value.relation) || !new Set(['enemy', 'ally', 'self']).has(value.relation)) {
                push(issues, `${path}.relation`, 'Expected enemy|ally|self');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'HAS_SKILL':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) {
                push(issues, `${path}.target`, 'Expected caster|target_actor');
            }
            if (!isString(value.skillId) || value.skillId.length === 0) {
                push(issues, `${path}.skillId`, 'Expected non-empty skill id');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'ACTOR_TYPE':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) {
                push(issues, `${path}.target`, 'Expected caster|target_actor');
            }
            if (!isString(value.actorType) || !new Set(['player', 'enemy', 'companion']).has(value.actorType)) {
                push(issues, `${path}.actorType`, 'Expected player|enemy|companion');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'TURN_START_ADJACENT':
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'PERSISTENT_TARGET_AVAILABLE':
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'COMPANION_PRESENT':
            if (!isString(value.owner) || !new Set(['caster', 'owner']).has(value.owner)) {
                push(issues, `${path}.owner`, 'Expected caster|owner');
            }
            if (value.subtype !== undefined && (!isString(value.subtype) || value.subtype.length === 0)) {
                push(issues, `${path}.subtype`, 'Expected non-empty subtype');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'COMPANION_MODE':
            if (!isString(value.target) || !new Set(['caster', 'owner_companion']).has(value.target)) {
                push(issues, `${path}.target`, 'Expected caster|owner_companion');
            }
            if (value.subtype !== undefined && (!isString(value.subtype) || value.subtype.length === 0)) {
                push(issues, `${path}.subtype`, 'Expected non-empty subtype');
            }
            if (!isString(value.mode) || !new Set(['scout', 'predator', 'roost']).has(value.mode)) {
                push(issues, `${path}.mode`, 'Expected scout|predator|roost');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'COMPANION_FLAG':
            if (!isString(value.target) || !new Set(['caster', 'owner_companion']).has(value.target)) {
                push(issues, `${path}.target`, 'Expected caster|owner_companion');
            }
            if (value.subtype !== undefined && (!isString(value.subtype) || value.subtype.length === 0)) {
                push(issues, `${path}.subtype`, 'Expected non-empty subtype');
            }
            if (!isString(value.flag) || !new Set(['keenSight', 'twinTalons', 'apexPredator']).has(value.flag)) {
                push(issues, `${path}.flag`, 'Expected keenSight|twinTalons|apexPredator');
            }
            if (value.value !== undefined && typeof value.value !== 'boolean') push(issues, `${path}.value`, 'Expected boolean');
            return true;
        case 'COMPANION_STATE_NUMBER':
            if (!isString(value.target) || !new Set(['caster', 'owner_companion']).has(value.target)) {
                push(issues, `${path}.target`, 'Expected caster|owner_companion');
            }
            if (value.subtype !== undefined && (!isString(value.subtype) || value.subtype.length === 0)) {
                push(issues, `${path}.subtype`, 'Expected non-empty subtype');
            }
            if (!isString(value.field) || !new Set(['orbitStep', 'revivalCooldown', 'apexStrikeCooldown', 'healCooldown']).has(value.field)) {
                push(issues, `${path}.field`, 'Expected supported companion state field');
            }
            if (!isString(value.op) || !new Set(['eq', 'lte', 'gte']).has(value.op)) push(issues, `${path}.op`, 'Expected eq|lte|gte');
            if (!isNumber(value.value)) push(issues, `${path}.value`, 'Expected number');
            return true;
        case 'STEALTH_COUNTER':
            if (!isString(value.target) || !new Set(['caster', 'target_actor']).has(value.target)) {
                push(issues, `${path}.target`, 'Expected caster|target_actor');
            }
            if (!isString(value.op) || !new Set(['eq', 'lte', 'gte']).has(value.op)) push(issues, `${path}.op`, 'Expected eq|lte|gte');
            if (!isNumber(value.value)) push(issues, `${path}.value`, 'Expected number');
            return true;
        default:
            push(issues, `${path}.type`, `Unknown predicate type "${String(value.type)}"`);
            return false;
    }
};

const validateInstruction = (value: unknown, issues: SkillAuthoringValidationIssue[], path: string): value is CombatScriptInstruction => {
    if (!isRecord(value)) {
        push(issues, path, 'Expected object');
        return false;
    }
    if (!isString(value.kind) || !VALID_KINDS.has(value.kind)) push(issues, `${path}.kind`, 'Invalid instruction kind');
    if (!isString(value.phase) || !VALID_PHASES.has(value.phase)) push(issues, `${path}.phase`, 'Invalid instruction phase');

    if ('pointPattern' in value && value.pointPattern !== undefined) {
        validatePointPattern(value.pointPattern, issues, `${path}.pointPattern`);
    }
    if ('pointSet' in value && value.pointSet !== undefined) {
        validatePointSet(value.pointSet, issues, `${path}.pointSet`);
    }
    if ('pointFilters' in value && value.pointFilters !== undefined) {
        validatePointFilters(value.pointFilters, issues, `${path}.pointFilters`);
    }
    if ('combatPointTargetMode' in value && value.combatPointTargetMode !== undefined) {
        if (!isString(value.combatPointTargetMode) || !new Set(['proxy_actor', 'actor_or_proxy', 'actor_only']).has(value.combatPointTargetMode)) {
            push(issues, `${path}.combatPointTargetMode`, 'Expected proxy_actor|actor_or_proxy|actor_only');
        }
    }
    if ('conditions' in value && value.conditions !== undefined) {
        if (!Array.isArray(value.conditions)) {
            push(issues, `${path}.conditions`, 'Expected array');
        } else {
            value.conditions.forEach((predicate, index) => validatePredicate(predicate, issues, `${path}.conditions[${index}]`));
        }
    }
    if (value.kind === 'SET_STEALTH') {
        if (!isString(value.target) || !new Set(['self', 'targetActor', 'owner', 'owner_companion']).has(value.target)) {
            push(issues, `${path}.target`, 'Expected supported actor ref');
        }
        if (!isNumber(value.amount)) {
            push(issues, `${path}.amount`, 'Expected number');
        }
    }
    if (value.kind === 'SPAWN_ACTOR' && value.spawnType === 'companion') {
        if (value.actorIdStrategy !== undefined
            && (!isString(value.actorIdStrategy) || !new Set(['raise_dead_skeleton_v1', 'falcon_owner_v1']).has(value.actorIdStrategy))) {
            push(issues, `${path}.actorIdStrategy`, 'Expected raise_dead_skeleton_v1|falcon_owner_v1');
        }
        if (value.placementPolicy !== undefined
            && (!isString(value.placementPolicy) || !new Set(['fail', 'push_friendly']).has(value.placementPolicy))) {
            push(issues, `${path}.placementPolicy`, 'Expected fail|push_friendly');
        }
        if (value.positionStrategy !== undefined
            && (!isString(value.positionStrategy) || !new Set(['selected_point', 'owner_adjacent_first_valid']).has(value.positionStrategy))) {
            push(issues, `${path}.positionStrategy`, 'Expected selected_point|owner_adjacent_first_valid');
        }
    }
    if (value.kind === 'MESSAGE') {
        if (value.format !== undefined && (!isString(value.format) || !new Set(['static', 'movement_summary', 'attack_summary']).has(value.format))) {
            push(issues, `${path}.format`, 'Expected static|movement_summary|attack_summary');
        }
        if (value.actor !== undefined && (!isString(value.actor) || !new Set(['self', 'target_actor']).has(value.actor))) {
            push(issues, `${path}.actor`, 'Expected self|target_actor');
        }
        if (value.targetActor !== undefined && (!isString(value.targetActor) || !new Set(['self', 'target_actor', 'impact_actor', 'owner', 'owner_companion', 'selected_hex']).has(value.targetActor))) {
            push(issues, `${path}.targetActor`, 'Expected self|target_actor|impact_actor|owner|owner_companion|selected_hex');
        }
        if (value.includeResolvedRange !== undefined && typeof value.includeResolvedRange !== 'boolean') {
            push(issues, `${path}.includeResolvedRange`, 'Expected boolean');
        }
    }
    if (value.kind === 'EMIT_JUICE') {
        if (value.targetActor !== undefined && (!isString(value.targetActor) || !new Set(['self', 'target_actor', 'impact_actor', 'owner', 'owner_companion']).has(value.targetActor))) {
            push(issues, `${path}.targetActor`, 'Expected self|target_actor|impact_actor|owner|owner_companion');
        }
        if (value.pathRef !== undefined && (!isString(value.pathRef) || !VALID_PATH_REFS.has(value.pathRef))) {
            push(issues, `${path}.pathRef`, 'Expected supported path ref');
        }
        if (value.directionRef !== undefined && (!isString(value.directionRef) || value.directionRef.length === 0)) {
            push(issues, `${path}.directionRef`, 'Expected point ref');
        }
        if (value.directionPathRef !== undefined && (!isString(value.directionPathRef) || !VALID_PATH_REFS.has(value.directionPathRef))) {
            push(issues, `${path}.directionPathRef`, 'Expected supported path ref');
        }
        if (value.contactHexRef !== undefined && (!isString(value.contactHexRef) || value.contactHexRef.length === 0)) {
            push(issues, `${path}.contactHexRef`, 'Expected point ref');
        }
        if (value.contactToRef !== undefined && (!isString(value.contactToRef) || value.contactToRef.length === 0)) {
            push(issues, `${path}.contactToRef`, 'Expected point ref');
        }
        if (value.contactFromRef !== undefined && (!isString(value.contactFromRef) || value.contactFromRef.length === 0)) {
            push(issues, `${path}.contactFromRef`, 'Expected point ref');
        }
        if (value.contactFromPathRef !== undefined && (!isString(value.contactFromPathRef) || !VALID_PATH_REFS.has(value.contactFromPathRef))) {
            push(issues, `${path}.contactFromPathRef`, 'Expected supported path ref');
        }
    }
    if (value.kind === 'TRACE_PROJECTILE') {
        if (value.target !== 'selected_hex') push(issues, `${path}.target`, 'Expected selected_hex');
        if (!isString(value.mode) || !new Set(['point_or_wall', 'target_actor']).has(value.mode)) {
            push(issues, `${path}.mode`, 'Expected point_or_wall|target_actor');
        }
    }
    if (value.kind === 'UPDATE_BEHAVIOR_STATE') {
        if (value.anchorActorRef !== undefined
            && (!isString(value.anchorActorRef) || !new Set(['self', 'target_actor', 'impact_actor', 'owner', 'owner_companion']).has(value.anchorActorRef))) {
            push(issues, `${path}.anchorActorRef`, 'Expected self|target_actor|impact_actor|owner|owner_companion');
        }
    }

    return true;
};

export const validateSkillAuthoringDefinition = (input: unknown): SkillAuthoringValidationIssue[] => {
    const issues: SkillAuthoringValidationIssue[] = [];
    if (!isRecord(input)) {
        push(issues, '$', 'Expected object');
        return issues;
    }

    if (!isString(input.id) || !/^[A-Z0-9_]+$/.test(input.id)) push(issues, '$.id', 'Expected uppercase skill id');
    if (!isString(input.name) || input.name.length === 0) push(issues, '$.name', 'Expected non-empty string');
    if (!isString(input.description) || input.description.length === 0) push(issues, '$.description', 'Expected non-empty string');
    if (!isString(input.slot) || !VALID_SLOTS.has(input.slot)) push(issues, '$.slot', 'Invalid slot');
    if (!isString(input.icon) || input.icon.length === 0) push(issues, '$.icon', 'Expected non-empty icon token');

    if (!Array.isArray(input.keywords)) {
        push(issues, '$.keywords', 'Expected keyword array');
    } else {
        input.keywords.forEach((keyword, index) => {
            if (!isString(keyword) || keyword.length === 0) push(issues, `$.keywords[${index}]`, 'Expected non-empty string');
        });
    }

    if (!isRecord(input.baseVariables)) {
        push(issues, '$.baseVariables', 'Expected object');
    } else {
        if (!isNumber(input.baseVariables.range)) push(issues, '$.baseVariables.range', 'Expected number');
        if (!isNumber(input.baseVariables.cost)) push(issues, '$.baseVariables.cost', 'Expected number');
        if (!isNumber(input.baseVariables.cooldown)) push(issues, '$.baseVariables.cooldown', 'Expected number');
    }

    if (!isRecord(input.targeting)) {
        push(issues, '$.targeting', 'Expected object');
    } else {
        if (!isString(input.targeting.generator) || !VALID_GENERATORS.has(input.targeting.generator)) push(issues, '$.targeting.generator', 'Invalid target generator');
        if (!isNumber(input.targeting.range)) push(issues, '$.targeting.range', 'Expected number');
        if (input.targeting.radius !== undefined && !isNumber(input.targeting.radius)) push(issues, '$.targeting.radius', 'Expected number');
        if (input.targeting.exposeSelfTarget !== undefined && typeof input.targeting.exposeSelfTarget !== 'boolean') {
            push(issues, '$.targeting.exposeSelfTarget', 'Expected boolean');
        }
        if (input.targeting.deterministicSort !== undefined && (!isString(input.targeting.deterministicSort) || !VALID_SORTS.has(input.targeting.deterministicSort))) {
            push(issues, '$.targeting.deterministicSort', 'Invalid deterministic sort');
        }
        if (input.targeting.predicates !== undefined) {
            if (!Array.isArray(input.targeting.predicates)) {
                push(issues, '$.targeting.predicates', 'Expected array');
            } else {
                input.targeting.predicates.forEach((predicate, index) => validatePredicate(predicate, issues, `$.targeting.predicates[${index}]`));
            }
        }
    }

    if (input.validationMessages !== undefined) {
        if (!isRecord(input.validationMessages)) {
            push(issues, '$.validationMessages', 'Expected object');
        }
    }

    if (input.preconditions !== undefined) {
        if (!Array.isArray(input.preconditions)) {
            push(issues, '$.preconditions', 'Expected array');
        } else {
            input.preconditions.forEach((precondition, index) => {
                if (!isRecord(precondition)) {
                    push(issues, `$.preconditions[${index}]`, 'Expected object');
                    return;
                }
                if (!isString(precondition.kind) || !new Set(['stunned']).has(precondition.kind)) {
                    push(issues, `$.preconditions[${index}].kind`, 'Expected stunned');
                }
                if (!isString(precondition.message)) {
                    push(issues, `$.preconditions[${index}].message`, 'Expected string');
                }
                if (typeof precondition.consumesTurn !== 'boolean') {
                    push(issues, `$.preconditions[${index}].consumesTurn`, 'Expected boolean');
                }
            });
        }
    }

    if (input.movementPolicy !== undefined) {
        if (!isRecord(input.movementPolicy)) {
            push(issues, '$.movementPolicy', 'Expected object');
        } else {
            if (input.movementPolicy.basePathing !== undefined
                && (!isString(input.movementPolicy.basePathing) || !new Set(['walk', 'teleport', 'flight']).has(input.movementPolicy.basePathing))) {
                push(issues, '$.movementPolicy.basePathing', 'Expected walk|teleport|flight');
            }
            if (input.movementPolicy.rangeSource !== undefined
                && (!isString(input.movementPolicy.rangeSource) || !new Set(['authored', 'actor_speed']).has(input.movementPolicy.rangeSource))) {
                push(issues, '$.movementPolicy.rangeSource', 'Expected authored|actor_speed');
            }
            if (input.movementPolicy.freeMoveRangeOverride !== undefined && !isNumber(input.movementPolicy.freeMoveRangeOverride)) {
                push(issues, '$.movementPolicy.freeMoveRangeOverride', 'Expected number');
            }
            if (input.movementPolicy.baseIgnoreWalls !== undefined && typeof input.movementPolicy.baseIgnoreWalls !== 'boolean') {
                push(issues, '$.movementPolicy.baseIgnoreWalls', 'Expected boolean');
            }
            if (input.movementPolicy.baseIgnoreGroundHazards !== undefined && typeof input.movementPolicy.baseIgnoreGroundHazards !== 'boolean') {
                push(issues, '$.movementPolicy.baseIgnoreGroundHazards', 'Expected boolean');
            }
            if (input.movementPolicy.baseAllowPassThroughActors !== undefined && typeof input.movementPolicy.baseAllowPassThroughActors !== 'boolean') {
                push(issues, '$.movementPolicy.baseAllowPassThroughActors', 'Expected boolean');
            }
            if (input.movementPolicy.validateDestination !== undefined) {
                if (!isRecord(input.movementPolicy.validateDestination)) {
                    push(issues, '$.movementPolicy.validateDestination', 'Expected object');
                } else {
                    const validateDestination = input.movementPolicy.validateDestination;
                    if (validateDestination.occupancy !== undefined
                        && (!isString(validateDestination.occupancy) || !new Set(['none', 'enemy', 'ally', 'any']).has(validateDestination.occupancy))) {
                        push(issues, '$.movementPolicy.validateDestination.occupancy', 'Expected none|enemy|ally|any');
                    }
                    if (validateDestination.requireWalkable !== undefined && typeof validateDestination.requireWalkable !== 'boolean') {
                        push(issues, '$.movementPolicy.validateDestination.requireWalkable', 'Expected boolean');
                    }
                    if (validateDestination.enforceBounds !== undefined && typeof validateDestination.enforceBounds !== 'boolean') {
                        push(issues, '$.movementPolicy.validateDestination.enforceBounds', 'Expected boolean');
                    }
                    if (validateDestination.ignoreHazards !== undefined && typeof validateDestination.ignoreHazards !== 'boolean') {
                        push(issues, '$.movementPolicy.validateDestination.ignoreHazards', 'Expected boolean');
                    }
                }
            }
        }
    }

    if (input.capabilities !== undefined) {
        validateCapabilities(input.capabilities, issues, '$.capabilities');
    }

    if (!Array.isArray(input.combatScript)) {
        push(issues, '$.combatScript', 'Expected combatScript array');
    } else {
        input.combatScript.forEach((instruction, index) => validateInstruction(instruction, issues, `$.combatScript[${index}]`));
    }

    if (!isRecord(input.upgrades)) {
        push(issues, '$.upgrades', 'Expected upgrades object');
    } else {
        Object.entries(input.upgrades).forEach(([upgradeId, value]) => {
            if (!isRecord(value)) {
                push(issues, `$.upgrades.${upgradeId}`, 'Expected object');
                return;
            }
            if (!isString(value.id) || value.id.length === 0) push(issues, `$.upgrades.${upgradeId}.id`, 'Expected non-empty id');
            if (!isString(value.name) || value.name.length === 0) push(issues, `$.upgrades.${upgradeId}.name`, 'Expected non-empty name');
            if (!isString(value.description) || value.description.length === 0) push(issues, `$.upgrades.${upgradeId}.description`, 'Expected non-empty description');
            if (value.when !== undefined) {
                if (!Array.isArray(value.when)) {
                    push(issues, `$.upgrades.${upgradeId}.when`, 'Expected array');
                } else {
                    value.when.forEach((predicate, index) => validatePredicate(predicate, issues, `$.upgrades.${upgradeId}.when[${index}]`));
                }
            }
            if (value.modifyNumbers !== undefined) {
                if (!Array.isArray(value.modifyNumbers)) {
                    push(issues, `$.upgrades.${upgradeId}.modifyNumbers`, 'Expected array');
                } else {
                    value.modifyNumbers.forEach((patch, index) => {
                        if (!isRecord(patch)) {
                            push(issues, `$.upgrades.${upgradeId}.modifyNumbers[${index}]`, 'Expected object');
                            return;
                        }
                        if (!isString(patch.path) || patch.path.length === 0) push(issues, `$.upgrades.${upgradeId}.modifyNumbers[${index}].path`, 'Expected non-empty path');
                        if (!isString(patch.op) || !new Set(['set', 'add', 'multiply']).has(patch.op)) push(issues, `$.upgrades.${upgradeId}.modifyNumbers[${index}].op`, 'Expected set|add|multiply');
                        if (!isNumber(patch.value)) push(issues, `$.upgrades.${upgradeId}.modifyNumbers[${index}].value`, 'Expected number');
                    });
                }
            }
            if (value.instructionPatches !== undefined) {
                if (!Array.isArray(value.instructionPatches)) {
                    push(issues, `$.upgrades.${upgradeId}.instructionPatches`, 'Expected array');
                } else {
                    value.instructionPatches.forEach((patch, index) => {
                        if (!isRecord(patch)) {
                            push(issues, `$.upgrades.${upgradeId}.instructionPatches[${index}]`, 'Expected object');
                            return;
                        }
                        if (!isString(patch.instructionId) || patch.instructionId.length === 0) push(issues, `$.upgrades.${upgradeId}.instructionPatches[${index}].instructionId`, 'Expected non-empty instruction id');
                        if (!isString(patch.path) || patch.path.length === 0) push(issues, `$.upgrades.${upgradeId}.instructionPatches[${index}].path`, 'Expected non-empty path');
                        if (!isString(patch.op) || !new Set(['set', 'add', 'multiply']).has(patch.op)) push(issues, `$.upgrades.${upgradeId}.instructionPatches[${index}].op`, 'Expected set|add|multiply');
                    });
                }
            }
            if (value.addInstructions !== undefined) {
                if (!Array.isArray(value.addInstructions)) {
                    push(issues, `$.upgrades.${upgradeId}.addInstructions`, 'Expected array');
                } else {
                    value.addInstructions.forEach((instruction, index) => validateInstruction(instruction, issues, `$.upgrades.${upgradeId}.addInstructions[${index}]`));
                }
            }
        });
    }

    if (input.targetingVariants !== undefined) {
        if (!Array.isArray(input.targetingVariants)) {
            push(issues, '$.targetingVariants', 'Expected array');
        } else {
            input.targetingVariants.forEach((variant, index) => {
                if (!isRecord(variant)) {
                    push(issues, `$.targetingVariants[${index}]`, 'Expected object');
                    return;
                }
                if (!Array.isArray(variant.when) || variant.when.length === 0) {
                    push(issues, `$.targetingVariants[${index}].when`, 'Expected non-empty predicate array');
                } else {
                    variant.when.forEach((predicate, predicateIndex) =>
                        validatePredicate(predicate, issues, `$.targetingVariants[${index}].when[${predicateIndex}]`)
                    );
                }
                if (!isRecord(variant.targeting)) {
                    push(issues, `$.targetingVariants[${index}].targeting`, 'Expected object');
                }
            });
        }
    }

    if (input.presentationVariants !== undefined) {
        if (!Array.isArray(input.presentationVariants)) {
            push(issues, '$.presentationVariants', 'Expected array');
        } else {
            input.presentationVariants.forEach((variant, index) => {
                if (!isRecord(variant)) {
                    push(issues, `$.presentationVariants[${index}]`, 'Expected object');
                    return;
                }
                if (!Array.isArray(variant.when) || variant.when.length === 0) {
                    push(issues, `$.presentationVariants[${index}].when`, 'Expected non-empty predicate array');
                } else {
                    variant.when.forEach((predicate, predicateIndex) =>
                        validatePredicate(predicate, issues, `$.presentationVariants[${index}].when[${predicateIndex}]`)
                    );
                }
            });
        }
    }

    return issues;
};

export const parseSkillAuthoringDefinition = (input: unknown): SkillAuthoringDefinition => {
    const parsed = parseJsonLike(input);
    const issues = validateSkillAuthoringDefinition(parsed);
    if (issues.length > 0) {
        throw new ContractValidationError('CompositeSkill', issues);
    }
    return parsed as SkillAuthoringDefinition;
};
