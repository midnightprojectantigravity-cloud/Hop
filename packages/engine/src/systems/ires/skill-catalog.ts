import type { GameState, SkillDefinition, SkillMetabolicBandProfile, SkillResourceProfile } from '../../types';
import type { SkillID } from '../../types/registry';
import { DEFAULT_IRES_METABOLIC_CONFIG } from './metabolic-config';
import type { IresMetabolicConfig } from './metabolic-types';

const buildLegacyProfile = (
    primaryResource: SkillResourceProfile['primaryResource'],
    primaryCost: number,
    baseStrain: number,
    countsAsMovement: boolean,
    countsAsAction: boolean
): SkillResourceProfile => ({
    primaryResource,
    primaryCost,
    baseStrain,
    countsAsMovement,
    countsAsAction,
    profileSource: 'legacy'
});

const PROFILE_NONE = buildLegacyProfile('none', 0, 0, false, false);
const PROFILE_SPARK_MOVE = buildLegacyProfile('spark', 20, 10, true, false);
const PROFILE_SPARK_ATTACK = buildLegacyProfile('spark', 30, 10, false, true);
const PROFILE_SPARK_HEAVY_UTILITY = buildLegacyProfile('spark', 30, 15, false, true);
const PROFILE_SPARK_HYBRID_MOVE = buildLegacyProfile('spark', 30, 15, true, true);
const PROFILE_MANA_STANDARD = buildLegacyProfile('mana', 5, 5, false, true);
const PROFILE_MANA_MOVE = buildLegacyProfile('mana', 5, 5, true, false);
const PROFILE_MANA_HEAVY = buildLegacyProfile('mana', 10, 15, false, true);
const PROFILE_MANA_HEAVY_MOVE = buildLegacyProfile('mana', 10, 15, true, true);

const LEGACY_SKILL_PROFILE_ENTRIES: Array<[SkillID, SkillResourceProfile]> = [
    ['BASIC_AWARENESS', PROFILE_NONE],
    ['BLIND_FIGHTING', PROFILE_NONE],
    ['ENEMY_AWARENESS', PROFILE_NONE],
    ['ORACLE_SIGHT', PROFILE_NONE],
    ['STANDARD_VISION', PROFILE_NONE],
    ['TACTICAL_INSIGHT', PROFILE_NONE],
    ['VIBRATION_SENSE', PROFILE_NONE],
    ['FALCON_AUTO_ROOST', PROFILE_NONE],
    ['THEME_HAZARDS', PROFILE_NONE],
    ['TIME_BOMB', PROFILE_NONE],
    ['BASIC_MOVE', PROFILE_SPARK_MOVE],
    ['DASH', PROFILE_SPARK_MOVE],
    ['BURROW', PROFILE_SPARK_MOVE],
    ['FLIGHT', PROFILE_SPARK_MOVE],
    ['GRAPPLE_HOOK', PROFILE_SPARK_MOVE],
    ['JUMP', PROFILE_SPARK_MOVE],
    ['SWIFT_ROLL', PROFILE_SPARK_MOVE],
    ['ARCHER_SHOT', PROFILE_SPARK_ATTACK],
    ['AUTO_ATTACK', PROFILE_SPARK_ATTACK],
    ['BASIC_ATTACK', PROFILE_SPARK_ATTACK],
    ['FALCON_APEX_STRIKE', PROFILE_SPARK_ATTACK],
    ['FALCON_PECK', PROFILE_SPARK_ATTACK],
    ['MULTI_SHOOT', PROFILE_SPARK_ATTACK],
    ['SHIELD_BASH', PROFILE_SPARK_ATTACK],
    ['SHIELD_THROW', PROFILE_SPARK_ATTACK],
    ['SNEAK_ATTACK', PROFILE_SPARK_ATTACK],
    ['SPEAR_THROW', PROFILE_SPARK_ATTACK],
    ['BOMB_TOSS', PROFILE_SPARK_HEAVY_UTILITY],
    ['KINETIC_TRI_TRAP', PROFILE_SPARK_HEAVY_UTILITY],
    ['SET_TRAP', PROFILE_SPARK_HEAVY_UTILITY],
    ['SMOKE_SCREEN', PROFILE_SPARK_HEAVY_UTILITY],
    ['BULWARK_CHARGE', PROFILE_SPARK_HYBRID_MOVE],
    ['VAULT', PROFILE_SPARK_HYBRID_MOVE],
    ['WITHDRAWAL', PROFILE_SPARK_HYBRID_MOVE],
    ['ABSORB_FIRE', PROFILE_MANA_STANDARD],
    ['COMBAT_ANALYSIS', PROFILE_MANA_STANDARD],
    ['FALCON_COMMAND', PROFILE_MANA_STANDARD],
    ['FALCON_HEAL', PROFILE_MANA_STANDARD],
    ['FALCON_SCOUT', PROFILE_MANA_STANDARD],
    ['FIREBALL', PROFILE_MANA_STANDARD],
    ['SENTINEL_TELEGRAPH', PROFILE_MANA_STANDARD],
    ['FIREWALK', PROFILE_MANA_MOVE],
    ['PHASE_STEP', PROFILE_MANA_MOVE],
    ['CORPSE_EXPLOSION', PROFILE_MANA_HEAVY],
    ['FIREWALL', PROFILE_MANA_HEAVY],
    ['RAISE_DEAD', PROFILE_MANA_HEAVY],
    ['SENTINEL_BLAST', PROFILE_MANA_HEAVY],
    ['SHADOW_STEP', PROFILE_MANA_HEAVY_MOVE],
    ['SOUL_SWAP', PROFILE_MANA_HEAVY_MOVE]
];

export const LEGACY_SKILL_PROFILE_MAP = new Map<string, SkillResourceProfile>(LEGACY_SKILL_PROFILE_ENTRIES);

export const PLAYER_DEFAULT_ACTIVE_SKILL_IDS = [
    'ABSORB_FIRE',
    'AUTO_ATTACK',
    'BASIC_ATTACK',
    'BASIC_MOVE',
    'CORPSE_EXPLOSION',
    'DASH',
    'FALCON_COMMAND',
    'FIREBALL',
    'FIREWALK',
    'FIREWALL',
    'GRAPPLE_HOOK',
    'JUMP',
    'KINETIC_TRI_TRAP',
    'RAISE_DEAD',
    'SHADOW_STEP',
    'SHIELD_BASH',
    'SHIELD_THROW',
    'SMOKE_SCREEN',
    'SNEAK_ATTACK',
    'SOUL_SWAP',
    'SPEAR_THROW',
    'VAULT',
    'WITHDRAWAL'
] as const satisfies readonly SkillID[];

export const ENEMY_RUNTIME_ACTIVE_SKILL_IDS = [
    'ARCHER_SHOT',
    'AUTO_ATTACK',
    'BASIC_ATTACK',
    'BASIC_MOVE',
    'BOMB_TOSS',
    'DASH',
    'FIREBALL',
    'GRAPPLE_HOOK',
    'SENTINEL_BLAST',
    'SENTINEL_TELEGRAPH',
    'SHIELD_BASH'
] as const satisfies readonly SkillID[];

const playerDefaultActiveRosterSet = new Set<string>(PLAYER_DEFAULT_ACTIVE_SKILL_IDS);
const enemyRuntimeActiveRosterSet = new Set<string>(ENEMY_RUNTIME_ACTIVE_SKILL_IDS);
const sharedActiveRosterIds = new Set<string>(
    PLAYER_DEFAULT_ACTIVE_SKILL_IDS.filter((skillId) => enemyRuntimeActiveRosterSet.has(skillId))
);
const activeRosterSkillIds = new Set<string>([
    ...PLAYER_DEFAULT_ACTIVE_SKILL_IDS,
    ...ENEMY_RUNTIME_ACTIVE_SKILL_IDS
]);

const createActiveScopeTags = (skillId: SkillID): SkillMetabolicBandProfile['scopeTags'] => {
    const tags: SkillMetabolicBandProfile['scopeTags'] = [];
    if (playerDefaultActiveRosterSet.has(skillId)) {
        tags.push('player_default');
    }
    if (enemyRuntimeActiveRosterSet.has(skillId)) {
        tags.push('enemy_runtime');
    }
    if (sharedActiveRosterIds.has(skillId)) {
        tags.push('shared_active');
    }
    return tags;
};

const buildBandProfile = (
    bandId: SkillMetabolicBandProfile['bandId'],
    resourceMode: SkillMetabolicBandProfile['resourceMode'],
    countsAsMovement: boolean,
    countsAsAction: boolean,
    travelEligible: boolean,
    skillId: SkillID,
    offsets?: Pick<SkillMetabolicBandProfile, 'sparkCostOffset' | 'manaCostOffset' | 'baseStrainOffset'>,
    scopeTags?: SkillMetabolicBandProfile['scopeTags']
): SkillMetabolicBandProfile => ({
    bandId,
    resourceMode,
    countsAsMovement,
    countsAsAction,
    travelEligible,
    scopeTags: [...(scopeTags || createActiveScopeTags(skillId))],
    ...(offsets?.sparkCostOffset !== undefined ? { sparkCostOffset: offsets.sparkCostOffset } : {}),
    ...(offsets?.manaCostOffset !== undefined ? { manaCostOffset: offsets.manaCostOffset } : {}),
    ...(offsets?.baseStrainOffset !== undefined ? { baseStrainOffset: offsets.baseStrainOffset } : {})
});

export const SKILL_BAND_MAP = new Map<string, SkillMetabolicBandProfile>([
    ['BASIC_MOVE', buildBandProfile('maintenance', 'spark_only', true, false, true, 'BASIC_MOVE')],
    ['DASH', buildBandProfile('light', 'spark_only', true, false, true, 'DASH', {
        sparkCostOffset: 2,
        baseStrainOffset: 2
    })],
    ['JUMP', buildBandProfile('light', 'spark_only', true, false, true, 'JUMP', {
        baseStrainOffset: 2
    })],
    ['ABSORB_FIRE', buildBandProfile('light', 'mana_only', false, true, false, 'ABSORB_FIRE')],
    ['SENTINEL_TELEGRAPH', buildBandProfile('light', 'mana_only', false, true, false, 'SENTINEL_TELEGRAPH', {
        manaCostOffset: -1,
        baseStrainOffset: -4
    })],
    ['FIREWALK', buildBandProfile('light', 'mana_only', true, false, false, 'FIREWALK', {
        baseStrainOffset: -1
    })],
    ['BASIC_ATTACK', buildBandProfile('standard', 'spark_only', false, true, false, 'BASIC_ATTACK', {
        sparkCostOffset: 2,
        baseStrainOffset: -1
    })],
    ['AUTO_ATTACK', buildBandProfile('standard', 'spark_only', false, true, false, 'AUTO_ATTACK', {
        sparkCostOffset: 2,
        baseStrainOffset: -1
    })],
    ['ARCHER_SHOT', buildBandProfile('standard', 'spark_only', false, true, false, 'ARCHER_SHOT', {
        sparkCostOffset: 2,
        baseStrainOffset: -1
    })],
    ['SPEAR_THROW', buildBandProfile('standard', 'spark_only', false, true, false, 'SPEAR_THROW', {
        sparkCostOffset: 2,
        baseStrainOffset: -1
    })],
    ['SHIELD_BASH', buildBandProfile('standard', 'spark_only', false, true, false, 'SHIELD_BASH', {
        sparkCostOffset: 2,
        baseStrainOffset: -1
    })],
    ['SHIELD_THROW', buildBandProfile('standard', 'spark_only', false, true, false, 'SHIELD_THROW', {
        sparkCostOffset: 2,
        baseStrainOffset: -1
    })],
    ['FIREBALL', buildBandProfile('standard', 'mana_only', false, true, false, 'FIREBALL', {
        manaCostOffset: -1,
        baseStrainOffset: -2
    })],
    ['FALCON_COMMAND', buildBandProfile('standard', 'mana_only', false, true, false, 'FALCON_COMMAND', {
        manaCostOffset: -2,
        baseStrainOffset: -3
    })],
    ['GRAPPLE_HOOK', buildBandProfile('heavy', 'spark_only', true, true, false, 'GRAPPLE_HOOK', {
        sparkCostOffset: -2
    })],
    ['VAULT', buildBandProfile('heavy', 'spark_only', true, true, false, 'VAULT', {
        sparkCostOffset: -2,
        baseStrainOffset: -2
    })],
    ['WITHDRAWAL', buildBandProfile('heavy', 'spark_only', true, true, false, 'WITHDRAWAL', {
        sparkCostOffset: -2,
        baseStrainOffset: -2
    })],
    ['SHADOW_STEP', buildBandProfile('heavy', 'mana_only', true, true, false, 'SHADOW_STEP', {
        manaCostOffset: -2,
        baseStrainOffset: -3
    })],
    ['SOUL_SWAP', buildBandProfile('heavy', 'mana_only', true, true, false, 'SOUL_SWAP', {
        manaCostOffset: -2,
        baseStrainOffset: -3
    })],
    ['KINETIC_TRI_TRAP', buildBandProfile('heavy', 'spark_only', false, true, false, 'KINETIC_TRI_TRAP', {
        sparkCostOffset: -2,
        baseStrainOffset: -2
    })],
    ['SMOKE_SCREEN', buildBandProfile('heavy', 'spark_only', false, true, false, 'SMOKE_SCREEN', {
        sparkCostOffset: -4,
        baseStrainOffset: -4
    })],
    ['BOMB_TOSS', buildBandProfile('heavy', 'spark_only', false, true, false, 'BOMB_TOSS', {
        sparkCostOffset: -2,
        baseStrainOffset: -2
    })],
    ['SNEAK_ATTACK', buildBandProfile('heavy', 'spark_only', false, true, false, 'SNEAK_ATTACK', {
        sparkCostOffset: -2,
        baseStrainOffset: -5
    })],
    ['FIREWALL', buildBandProfile('heavy', 'mana_only', false, true, false, 'FIREWALL', {
        manaCostOffset: -1,
        baseStrainOffset: -2
    })],
    ['CORPSE_EXPLOSION', buildBandProfile('heavy', 'mana_only', false, true, false, 'CORPSE_EXPLOSION', {
        manaCostOffset: -1,
        baseStrainOffset: -2
    })],
    ['RAISE_DEAD', buildBandProfile('heavy', 'mana_only', false, true, false, 'RAISE_DEAD', {
        manaCostOffset: -1,
        baseStrainOffset: -3
    })],
    ['SENTINEL_BLAST', buildBandProfile('redline', 'mana_only', false, true, false, 'SENTINEL_BLAST', {
        manaCostOffset: -8,
        baseStrainOffset: 2
    })],
    ['BASIC_AWARENESS', buildBandProfile('maintenance', 'none', false, false, false, 'BASIC_AWARENESS', undefined, [
        'loadout_capability'
    ])],
    ['COMBAT_ANALYSIS', buildBandProfile('maintenance', 'none', false, false, false, 'COMBAT_ANALYSIS', undefined, [
        'loadout_capability'
    ])],
    ['STANDARD_VISION', buildBandProfile('maintenance', 'none', false, false, false, 'STANDARD_VISION', undefined, [
        'loadout_capability'
    ])],
    ['TACTICAL_INSIGHT', buildBandProfile('maintenance', 'none', false, false, false, 'TACTICAL_INSIGHT', undefined, [
        'loadout_capability'
    ])],
    ['BURROW', buildBandProfile('maintenance', 'none', false, false, false, 'BURROW', undefined, [
        'loadout_capability'
    ])],
    ['FLIGHT', buildBandProfile('maintenance', 'none', false, false, false, 'FLIGHT', undefined, [
        'loadout_capability'
    ])],
    ['PHASE_STEP', buildBandProfile('maintenance', 'none', false, false, false, 'PHASE_STEP', undefined, [
        'loadout_capability'
    ])],
    ['BLIND_FIGHTING', buildBandProfile('maintenance', 'none', false, false, false, 'BLIND_FIGHTING', undefined, [
        'system_passive'
    ])],
    ['ENEMY_AWARENESS', buildBandProfile('maintenance', 'none', false, false, false, 'ENEMY_AWARENESS', undefined, [
        'system_passive'
    ])],
    ['ORACLE_SIGHT', buildBandProfile('maintenance', 'none', false, false, false, 'ORACLE_SIGHT', undefined, [
        'system_passive'
    ])],
    ['THEME_HAZARDS', buildBandProfile('maintenance', 'none', false, false, false, 'THEME_HAZARDS', undefined, [
        'system_passive'
    ])],
    ['VIBRATION_SENSE', buildBandProfile('maintenance', 'none', false, false, false, 'VIBRATION_SENSE', undefined, [
        'system_passive'
    ])],
    ['FALCON_AUTO_ROOST', buildBandProfile('maintenance', 'none', false, false, false, 'FALCON_AUTO_ROOST', undefined, [
        'companion_runtime'
    ])],
    ['TIME_BOMB', buildBandProfile('maintenance', 'none', false, false, false, 'TIME_BOMB', undefined, [
        'spawned_runtime'
    ])],
    ['BULWARK_CHARGE', buildBandProfile('heavy', 'spark_only', true, true, false, 'BULWARK_CHARGE', {
        sparkCostOffset: -2,
        baseStrainOffset: -5
    }, ['off_roster_action'])],
    ['MULTI_SHOOT', buildBandProfile('standard', 'spark_only', false, true, false, 'MULTI_SHOOT', {
        sparkCostOffset: 6,
        baseStrainOffset: -2
    }, ['off_roster_action'])],
    ['SET_TRAP', buildBandProfile('heavy', 'spark_only', false, true, false, 'SET_TRAP', {
        sparkCostOffset: -2,
        baseStrainOffset: -5
    }, ['off_roster_action'])],
    ['SWIFT_ROLL', buildBandProfile('light', 'spark_only', true, false, true, 'SWIFT_ROLL', {
        sparkCostOffset: 4,
        baseStrainOffset: 4
    }, ['off_roster_action'])],
    ['FALCON_PECK', buildBandProfile('standard', 'spark_only', false, true, false, 'FALCON_PECK', {
        sparkCostOffset: 6,
        baseStrainOffset: -2
    }, ['companion_runtime'])],
    ['FALCON_APEX_STRIKE', buildBandProfile('heavy', 'spark_only', false, true, false, 'FALCON_APEX_STRIKE', {
        sparkCostOffset: -2,
        baseStrainOffset: -10
    }, ['companion_runtime'])],
    ['FALCON_HEAL', buildBandProfile('light', 'mana_only', false, true, false, 'FALCON_HEAL', {
        baseStrainOffset: -1
    }, ['companion_runtime'])],
    ['FALCON_SCOUT', buildBandProfile('light', 'mana_only', true, false, false, 'FALCON_SCOUT', {
        baseStrainOffset: -1
    }, ['companion_runtime'])]
]);

const cloneSkillResourceProfile = (profile: SkillResourceProfile): SkillResourceProfile => ({ ...profile });

const resolveDefaultTravelEligibility = (profile: Pick<SkillResourceProfile, 'countsAsMovement' | 'countsAsAction'>): boolean =>
    profile.countsAsMovement && !profile.countsAsAction;

const resolveBandPrimaryResource = (
    resourceMode: SkillMetabolicBandProfile['resourceMode']
): SkillResourceProfile['primaryResource'] => {
    if (resourceMode === 'spark_only' || resourceMode === 'hybrid') return 'spark';
    if (resourceMode === 'mana_only') return 'mana';
    return 'none';
};

const resolveBandPrimaryCost = (
    bandProfile: SkillMetabolicBandProfile,
    config: IresMetabolicConfig
): number => {
    const band = config.actionBands[bandProfile.bandId];
    if (!band) {
        return 0;
    }
    if (bandProfile.resourceMode === 'spark_only' || bandProfile.resourceMode === 'hybrid') {
        return Math.max(0, band.sparkCost + (bandProfile.sparkCostOffset || 0));
    }
    if (bandProfile.resourceMode === 'mana_only') {
        return Math.max(0, band.manaCost + (bandProfile.manaCostOffset || 0));
    }
    return 0;
};

export const resolveLegacySkillResourceProfile = (skillId: string): SkillResourceProfile =>
    cloneSkillResourceProfile(LEGACY_SKILL_PROFILE_MAP.get(skillId) || PROFILE_NONE);

export const resolveSkillMetabolicBandProfile = (skillId: string): SkillMetabolicBandProfile | undefined => {
    const profile = SKILL_BAND_MAP.get(skillId);
    return profile ? { ...profile, scopeTags: [...profile.scopeTags] } : undefined;
};

export const deriveSkillResourceProfileFromBand = (
    profile: SkillMetabolicBandProfile,
    metabolicConfig: IresMetabolicConfig = DEFAULT_IRES_METABOLIC_CONFIG
): SkillResourceProfile => {
    const band = metabolicConfig.actionBands[profile.bandId];
    const primaryResource = resolveBandPrimaryResource(profile.resourceMode);
    const primaryCost = resolveBandPrimaryCost(profile, metabolicConfig);
    const baseStrain = Math.max(0, (band?.baseExhaustion || 0) + (profile.baseStrainOffset || 0));
    return {
        primaryResource,
        primaryCost,
        baseStrain,
        countsAsMovement: profile.countsAsMovement,
        countsAsAction: profile.countsAsAction,
        redlineAllowed: profile.bandId === 'redline' ? true : undefined,
        travelEligible: profile.travelEligible,
        metabolicBandId: profile.bandId,
        profileSource: 'band_derived'
    };
};

export const resolveSkillResourceProfile = (
    skillId: string,
    metabolicConfig: IresMetabolicConfig = DEFAULT_IRES_METABOLIC_CONFIG
): SkillResourceProfile => {
    const bandProfile = resolveSkillMetabolicBandProfile(skillId);
    if (bandProfile) {
        return deriveSkillResourceProfileFromBand(bandProfile, metabolicConfig);
    }
    return resolveLegacySkillResourceProfile(skillId);
};

export const resolveRuntimeSkillResourceProfile = (
    skillId: string,
    skillDef?: Pick<SkillDefinition, 'resourceProfile' | 'metabolicBandProfile'>,
    ruleset?: GameState['ruleset']
): SkillResourceProfile => {
    const bandProfile = skillDef?.metabolicBandProfile || resolveSkillMetabolicBandProfile(skillId);
    if (bandProfile) {
        return deriveSkillResourceProfileFromBand(
            bandProfile,
            ruleset?.ires?.metabolism || DEFAULT_IRES_METABOLIC_CONFIG
        );
    }

    const legacyProfile = skillDef?.resourceProfile || resolveLegacySkillResourceProfile(skillId);
    return {
        ...legacyProfile,
        travelEligible: legacyProfile.travelEligible ?? resolveDefaultTravelEligibility(legacyProfile),
        profileSource: legacyProfile.profileSource || 'legacy'
    };
};

export const listMappedActiveRosterSkillIds = (): string[] =>
    [...SKILL_BAND_MAP.keys()]
        .filter((skillId) => activeRosterSkillIds.has(skillId))
        .sort((left, right) => left.localeCompare(right));

export const listBandMappedSkillIds = (): string[] =>
    [...SKILL_BAND_MAP.keys()].sort((left, right) => left.localeCompare(right));

export const listExpandedBandMappedSkillIds = (): string[] =>
    [...SKILL_BAND_MAP.keys()]
        .filter((skillId) => !activeRosterSkillIds.has(skillId))
        .sort((left, right) => left.localeCompare(right));

export const listLegacyFallbackSkillIds = (): string[] =>
    [...LEGACY_SKILL_PROFILE_MAP.keys()]
        .filter((skillId) => !SKILL_BAND_MAP.has(skillId))
        .sort((left, right) => left.localeCompare(right));
