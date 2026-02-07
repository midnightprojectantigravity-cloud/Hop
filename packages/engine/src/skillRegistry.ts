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
import { BOMB_TOSS } from './skills/bomb_toss';
import { CORPSE_EXPLOSION } from './skills/corpse_explosion';
import { RAISE_DEAD } from './skills/raise_dead';
import { SOUL_SWAP } from './skills/soul_swap';
import { MULTI_SHOOT } from './skills/multi_shoot';
import { SET_TRAP } from './skills/set_trap';
import { SWIFT_ROLL } from './skills/swift_roll';
import { SNEAK_ATTACK } from './skills/sneak_attack';
import { SMOKE_SCREEN } from './skills/smoke_screen';
import { SHADOW_STEP } from './skills/shadow_step';
import { FALCON_COMMAND } from './skills/falcon_command';
import { FALCON_PECK } from './skills/falcon_peck';
import { FALCON_APEX_STRIKE } from './skills/falcon_apex_strike';
import { FALCON_HEAL } from './skills/falcon_heal';
import { FALCON_SCOUT } from './skills/falcon_scout';
import { KINETIC_TRI_TRAP } from './skills/kinetic_tri_trap';
import { WITHDRAWAL } from './skills/withdrawal';
import { ABSORB_FIRE } from './skills/absorb_fire';
import type { SkillDefinition } from './types';
import type { SkillID } from './types/registry';

/**
 * A registry of all skills using the new Compositional Skill Framework.
 */
export const COMPOSITIONAL_SKILLS = {
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
    BOMB_TOSS,
    CORPSE_EXPLOSION,
    RAISE_DEAD,
    SOUL_SWAP,
    MULTI_SHOOT,
    SET_TRAP,
    SWIFT_ROLL,
    SNEAK_ATTACK,
    SMOKE_SCREEN,
    SHADOW_STEP,
    FALCON_COMMAND,
    FALCON_PECK,
    FALCON_APEX_STRIKE,
    FALCON_HEAL,
    FALCON_SCOUT,
    KINETIC_TRI_TRAP,
    WITHDRAWAL,
    ABSORB_FIRE,
};

/**
 * Creates an ActiveSkill instance from a SkillID.
 */
export function createActiveSkill(id: SkillID): any {
    const registry = COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>;
    const def = registry[id];
    if (!def) return null;

    return {
        id,
        name: def.name,
        description: typeof def.description === 'function' ? def.description({} as any) : def.description,
        slot: def.slot,
        cooldown: def.baseVariables.cooldown || 0,
        currentCooldown: 0,
        range: def.baseVariables.range || 0,
        upgrades: Object.keys(def.upgrades || {}),
        activeUpgrades: [],
    };
}

/**
 * Creates the initial skill set for a new player.
 */
export function createDefaultSkills(): any[] {
    return [
        createActiveSkill('BASIC_ATTACK'),
        createActiveSkill('AUTO_ATTACK'),
        createActiveSkill('SPEAR_THROW'),
        createActiveSkill('SHIELD_BASH'),
        createActiveSkill('JUMP'),
    ].filter(Boolean);
}

// Export as SkillRegistry for convenience
const SkillRegistryBase = {
    ...COMPOSITIONAL_SKILLS,

    /**
     * Find a skill definition by ID.
     */
    get: (id: string): SkillDefinition | undefined => {
        return (COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>)[id];
    },

    /**
     * Flattened list of all upgrades from all skills.
     */
    getAllUpgrades: () => {
        return Object.values(COMPOSITIONAL_SKILLS).flatMap(s =>
            Object.values(s.upgrades || {}).map(u => ({ ...u, skillId: s.id }))
        );
    },

    /**
     * Get a specific upgrade by ID.
     */
    getUpgrade: (upgradeId: string) => {
        for (const skill of Object.values(COMPOSITIONAL_SKILLS)) {
            if (skill.upgrades?.[upgradeId]) return skill.upgrades[upgradeId];
        }
        return undefined;
    },

    /**
     * Find which skill ID owns a given upgrade ID.
     */
    getSkillForUpgrade: (upgradeId: string): string | undefined => {
        for (const [skillId, skill] of Object.entries(COMPOSITIONAL_SKILLS)) {
            if (skill.upgrades?.[upgradeId]) return skillId;
        }
        return undefined;
    },

    /**
     * Get the dynamic range of a skill for an actor, including upgrades.
     */
    getSkillRange: (actor: any, skillId: string): number => {
        const skill = (actor.activeSkills || []).find((s: any) => s.id === skillId);
        const def = (COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>)[skillId];
        if (!def) return skill?.range || 0;

        let range = def.baseVariables.range;
        if (skill?.activeUpgrades) {
            skill.activeUpgrades.forEach((upId: string) => {
                const mod = def.upgrades[upId];
                if (mod?.modifyRange) range += mod.modifyRange;
            });
        }
        return range;
    }
};

export const SkillRegistry = SkillRegistryBase as typeof SkillRegistryBase & Record<string, any>;

/**
 * Get the dynamic range of a skill for an actor, including upgrades.
 */
export const getSkillRange = SkillRegistry.getSkillRange;

/**
 * Find a skill definition by ID. (Legacy helper kept for compatibility)
 */
export const getSkillDefinition = (id: string): SkillDefinition | undefined => {
    return SkillRegistry.get(id);
};
