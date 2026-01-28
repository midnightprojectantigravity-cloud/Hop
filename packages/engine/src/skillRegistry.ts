/**
 * SKILL REGISTRY
 * Central registration for the Compositional Skill System.
 * Every skill defined here is available to players and enemies.
 * TODO: Implement "Dynamic Discovery" to automatically register skills from the /skills folder.
 */
import { GRAPPLE_HOOK } from './skills/grapple_hook';
import { SPEAR_THROW } from './skills/spear_throw';
import { SHIELD_BASH } from './skills/shield_bash';
import { JUMP } from './skills/jump';
import { BULWARK_CHARGE } from './skills/bulwark_charge';
import { BASIC_ATTACK } from './skills/basic_attack';
import { AUTO_ATTACK } from './skills/auto_attack';
import { SENTINEL_BLAST } from './skills/sentinel_blast';
import { THEME_HAZARDS } from './skills/theme_hazard';
import { SHIELD_THROW } from './skills/shield_throw';
import { VAULT } from './skills/vault';
import { BASIC_MOVE } from './skills/basic_move';
import { DASH } from './skills/dash';
import { FIREBALL } from './skills/fireball';
import { FIREWALL } from './skills/firewall';
import { FIREWALK } from './skills/firewalk';
import { CORPSE_EXPLOSION } from './skills/corpse_explosion';
import { RAISE_DEAD } from './skills/raise_dead';
import { SOUL_SWAP } from './skills/soul_swap';
import { MULTI_SHOOT } from './skills/multi_shoot';
import { SET_TRAP } from './skills/set_trap';
import { SWIFT_ROLL } from './skills/swift_roll';
import { SNEAK_ATTACK } from './skills/sneak_attack';
import { SMOKE_SCREEN } from './skills/smoke_screen';
import { SHADOW_STEP } from './skills/shadow_step';
import type { SkillDefinition } from './types';

/**
 * A registry of all skills using the new Compositional Skill Framework.
 */
export const COMPOSITIONAL_SKILLS: Record<string, SkillDefinition> = {
    GRAPPLE_HOOK,
    SPEAR_THROW,
    SHIELD_BASH,
    SHIELD_THROW,
    VAULT,
    JUMP,
    BULWARK_CHARGE,
    BASIC_ATTACK,
    AUTO_ATTACK,
    SENTINEL_BLAST,
    THEME_HAZARDS,
    BASIC_MOVE,
    DASH,
    FIREBALL,
    FIREWALL,
    FIREWALK,
    CORPSE_EXPLOSION,
    RAISE_DEAD,
    SOUL_SWAP,
    MULTI_SHOOT,
    SET_TRAP,
    SWIFT_ROLL,
    SNEAK_ATTACK,
    SMOKE_SCREEN,
    SHADOW_STEP,
};

/**
 * Find a skill definition by ID.
 */
export const getSkillDefinition = (id: string): SkillDefinition | undefined => {
    return COMPOSITIONAL_SKILLS[id];
};
