import type { SkillDefinition } from './types';
import { GRAPPLE_HOOK } from './skills/grapple_hook';
import { SPEAR_THROW } from './skills/spear_throw';
import { SHIELD_BASH } from './skills/shield_bash';
import { JUMP } from './skills/jump';

/**
 * A registry of all skills using the new Compositional Skill Framework.
 */
export const COMPOSITIONAL_SKILLS: Record<string, SkillDefinition> = {
    GRAPPLE_HOOK,
    SPEAR_THROW,
    SHIELD_BASH,
    JUMP,
};

/**
 * Find a skill definition by ID.
 */
export const getSkillDefinition = (id: string): SkillDefinition | undefined => {
    return COMPOSITIONAL_SKILLS[id];
};
