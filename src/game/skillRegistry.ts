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
import type { SkillDefinition } from './types';

/**
 * A registry of all skills using the new Compositional Skill Framework.
 */
export const COMPOSITIONAL_SKILLS: Record<string, SkillDefinition> = {
    GRAPPLE_HOOK,
    SPEAR_THROW,
    SHIELD_BASH,
    JUMP,
    BULWARK_CHARGE,
    BASIC_ATTACK,
    AUTO_ATTACK,
    SENTINEL_BLAST,
};

/**
 * Find a skill definition by ID.
 */
export const getSkillDefinition = (id: string): SkillDefinition | undefined => {
    return COMPOSITIONAL_SKILLS[id];
};
