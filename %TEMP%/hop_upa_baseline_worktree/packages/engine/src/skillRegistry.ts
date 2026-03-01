/**
 * SKILL REGISTRY
 * Central registration for the Compositional Skill System.
 * Every skill defined here is available to players and enemies.
 */
import type { SkillDefinition } from './types';
import type { SkillID } from './types/registry';
import { hydrateSkillIntentProfiles } from './systems/skill-intent-profile';
import { getCompositeSkillRuntimeRegistry } from './systems/composite-skill-bridge';
import { GENERATED_COMPOSITIONAL_SKILLS } from './generated/skill-registry.generated';

/**
 * A registry of all skills using the new Compositional Skill Framework.
 */
export const COMPOSITIONAL_SKILLS = GENERATED_COMPOSITIONAL_SKILLS;

const skillIntentCoverage = hydrateSkillIntentProfiles(COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>);
if (skillIntentCoverage.missing.length > 0 || skillIntentCoverage.invalid.length > 0) {
    const missing = skillIntentCoverage.missing.join(', ');
    const invalid = skillIntentCoverage.invalid.map(x => `${x.skillId}: ${x.errors.join('; ')}`).join(' | ');
    throw new Error(`Skill intent profile validation failed. missing=[${missing}] invalid=[${invalid}]`);
}

const getMergedRegistry = (): Record<string, SkillDefinition> => ({
    ...(COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>),
    ...getCompositeSkillRuntimeRegistry()
});

/**
 * Creates an ActiveSkill instance from a SkillID.
 */
export function createActiveSkill(id: SkillID | string): any {
    const registry = getMergedRegistry();
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
        createActiveSkill('BASIC_MOVE'),
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
        const registry = getMergedRegistry();
        return registry[id];
    },

    /**
     * Flattened list of all upgrades from all skills.
     */
    getAllUpgrades: () => {
        const registry = getMergedRegistry();
        return Object.values(registry).flatMap(s =>
            Object.values(s.upgrades || {}).map(u => ({ ...u, skillId: s.id }))
        );
    },

    /**
     * Get a specific upgrade by ID.
     */
    getUpgrade: (upgradeId: string) => {
        const registry = getMergedRegistry();
        for (const skill of Object.values(registry)) {
            if (skill.upgrades?.[upgradeId]) return skill.upgrades[upgradeId];
        }
        return undefined;
    },

    /**
     * Find which skill ID owns a given upgrade ID.
     */
    getSkillForUpgrade: (upgradeId: string): string | undefined => {
        const registry = getMergedRegistry();
        for (const [skillId, skill] of Object.entries(registry)) {
            if (skill.upgrades?.[upgradeId]) return skillId;
        }
        return undefined;
    },

    /**
     * Get the dynamic range of a skill for an actor, including upgrades.
     */
    getSkillRange: (actor: any, skillId: string): number => {
        const skill = (actor.activeSkills || []).find((s: any) => s.id === skillId);
        const def = getMergedRegistry()[skillId];
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
