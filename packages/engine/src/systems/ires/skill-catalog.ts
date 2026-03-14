import type { SkillID } from '../../types/registry';
import type { SkillResourceProfile } from '../../types';

const buildProfile = (
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
    countsAsAction
});

const PROFILE_NONE = buildProfile('none', 0, 0, false, false);
const PROFILE_SPARK_MOVE = buildProfile('spark', 20, 10, true, false);
const PROFILE_SPARK_ATTACK = buildProfile('spark', 30, 10, false, true);
const PROFILE_SPARK_HEAVY_UTILITY = buildProfile('spark', 30, 15, false, true);
const PROFILE_SPARK_HYBRID_MOVE = buildProfile('spark', 30, 15, true, true);
const PROFILE_MANA_STANDARD = buildProfile('mana', 5, 5, false, true);
const PROFILE_MANA_MOVE = buildProfile('mana', 5, 5, true, false);
const PROFILE_MANA_HEAVY = buildProfile('mana', 10, 15, false, true);
const PROFILE_MANA_HEAVY_MOVE = buildProfile('mana', 10, 15, true, true);

const SKILL_PROFILE_ENTRIES: Array<[SkillID, SkillResourceProfile]> = [
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

const SKILL_PROFILE_MAP = new Map<string, SkillResourceProfile>(SKILL_PROFILE_ENTRIES);

export const resolveSkillResourceProfile = (skillId: string): SkillResourceProfile =>
    SKILL_PROFILE_MAP.get(skillId) || PROFILE_NONE;
