/**
 * TYPE-SAFE REGISTRY
 * 
 * This file centralizes all IDs used in the engine to prevent magic string drift.
 * ALWAYS use these literal union types instead of 'string'.
 */

/** All known Tile IDs */
export type TileID =
    | 'GRASS'
    | 'STONE'
    | 'LAVA'
    | 'WALL'
    | 'ICE'
    | 'VOID'
    | 'STAIRS'
    | 'SHRINE'
    | 'GATE'
    | 'BRIDGE';

/** All known Tile Effect IDs */
export type TileEffectID =
    | 'FIRE'
    | 'WET'
    | 'OIL'
    | 'STEAM'
    | 'BLESSED'
    | 'CURSED'
    | 'ICE_WALL'
    | 'SMOKE'
    | 'BOMB_TICK'
    | 'TRI_TRAP'
    | 'SNARE';

/** All known Skill IDs */
export type SkillID =
    | 'AUTO_ATTACK'
    | 'BASIC_MOVE'
    | 'BASIC_ATTACK'
    | 'DASH'
    | 'JUMP'
    | 'SHIELD_BASH'
    | 'BULWARK_CHARGE'
    | 'VAULT'
    | 'GRAPPLE_HOOK'
    | 'SHIELD_THROW'
    | 'SENTINEL_TELEGRAPH'
    | 'SENTINEL_BLAST'
    | 'FIREBALL'
    | 'SPEAR_THROW'
    | 'ARCHER_SHOT'
    | 'CORPSE_EXPLOSION'
    | 'FIREWALK'
    | 'FIREWALL'
    | 'BOMB_TOSS'
    | 'TIME_BOMB'
    | 'MULTI_SHOOT'
    | 'RAISE_DEAD'
    | 'SET_TRAP'
    | 'SHADOW_STEP'
    | 'SMOKE_SCREEN'
    | 'SNEAK_ATTACK'
    | 'SOUL_SWAP'
    | 'SWIFT_ROLL'
    | 'THEME_HAZARDS'
    | 'FALCON_COMMAND'
    | 'FALCON_PECK'
    | 'FALCON_APEX_STRIKE'
    | 'FALCON_HEAL'
    | 'FALCON_SCOUT'
    | 'FALCON_AUTO_ROOST'
    | 'KINETIC_TRI_TRAP'
    | 'WITHDRAWAL'
    | 'ABSORB_FIRE';

/** All known Status Effect Types */
export type StatusID =
    | 'stunned'
    | 'poisoned'
    | 'armored'
    | 'hidden'
    | 'rooted'
    | 'fire_immunity'
    | 'burning'
    | 'time_bomb'
    | 'protected'
    | 'marked_scout'
    | 'marked_predator';

/** All known Archetypes */
export type ArchetypeID =
    | 'VANGUARD'
    | 'SKIRMISHER'
    | 'FIREMAGE'
    | 'NECROMANCER'
    | 'HUNTER'
    | 'ASSASSIN';

/** All known Juice Effects */
export type JuiceEffectID =
    | 'shake'
    | 'flash'
    | 'freeze'
    | 'combat_text'
    | 'impact'
    | 'lavaSink'
    | 'lavaRipple'
    | 'wallCrack'
    | 'iceShatter'
    | 'voidConsume'
    | 'explosion_ring'
    | 'spearTrail'
    | 'shieldArc'
    | 'hookCable'
    | 'dashBlur'
    | 'momentumTrail'
    | 'heavyImpact'
    | 'lightImpact'
    | 'kineticWave'
    | 'anticipation'
    | 'chargeUp'
    | 'aimingLaser'
    | 'trajectory'
    | 'grappleHookWinch'
    | 'shieldSpin'
    | 'spearWhistle'
    | 'vaultLeap'
    | 'stunBurst'
    | 'poisonCloud'
    | 'armorGleam'
    | 'hiddenFade'
    | 'vaporize';
