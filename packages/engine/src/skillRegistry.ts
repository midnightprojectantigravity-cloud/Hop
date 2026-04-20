/**
 * SKILL REGISTRY
 * Central registration for the Compositional Skill System.
 * Every skill defined here is available to players and enemies.
 */
import type { SkillDefinition } from './types';
import type { SkillID } from './types/registry';
import { hydrateSkillIntentProfiles } from './systems/skill-intent-profile';
import { getCompositeSkillRuntimeRegistry } from './systems/composite-skill-bridge';
import { getRuntimeSkillDefinition, getRuntimeSkillDefinitionRegistry } from './systems/skill-runtime/bridge';
import { resolveSkillRuntime } from './systems/skill-runtime/resolve';
import { GENERATED_COMPOSITIONAL_SKILLS } from './generated/skill-registry.generated';
import { registerCapabilitySkillDefinitionResolver } from './systems/capabilities/cache';
import { resolveSkillMetabolicBandProfile, resolveSkillResourceProfile } from './systems/ires';
import { resolveVirtualSkillDefinition } from './systems/skill-upgrade-resolution';
import { getSkillScenarios } from './scenarios/skill-scenarios';
import { hexEquals } from './hex';

/**
 * Residual TypeScript-authored compositional skills.
 * Live runtime-authored skills are merged in through the runtime bridge below.
 */
export const COMPOSITIONAL_SKILLS = GENERATED_COMPOSITIONAL_SKILLS;

let skillIntentCoverageValidated = false;
let capabilityResolverRegistered = false;

// Compatibility boundary: shared engine consumers still ask `SkillRegistry`
// for `SkillDefinition`-shaped objects, so runtime-authored skills are
// materialized into that shape here and only here.
const getBaseRegistry = (): Record<string, SkillDefinition> => ({
    ...(COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>),
    ...getCompositeSkillRuntimeRegistry(),
    ...getRuntimeSkillDefinitionRegistry()
});

const ensureSkillIntentCoverageValidated = (registry: Record<string, SkillDefinition>): void => {
    if (skillIntentCoverageValidated) return;
    const skillIntentCoverage = hydrateSkillIntentProfiles(registry);
    if (skillIntentCoverage.missing.length > 0 || skillIntentCoverage.invalid.length > 0) {
        const missing = skillIntentCoverage.missing.join(', ');
        const invalid = skillIntentCoverage.invalid.map(x => `${x.skillId}: ${x.errors.join('; ')}`).join(' | ');
        throw new Error(`Skill intent profile validation failed. missing=[${missing}] invalid=[${invalid}]`);
    }
    skillIntentCoverageValidated = true;
};

const getMergedRegistry = (): Record<string, SkillDefinition> => {
    const registry = getBaseRegistry();
    ensureSkillIntentCoverageValidated(registry);
    if (!capabilityResolverRegistered) {
        registerCapabilitySkillDefinitionResolver((skillId: string) => SkillRegistry.get(skillId));
        capabilityResolverRegistered = true;
    }
    return Object.fromEntries(
        Object.entries(registry).map(([skillId, def]) => {
            const metabolicBandProfile = def.metabolicBandProfile || resolveSkillMetabolicBandProfile(skillId);
            const resourceProfile = def.resourceProfile || resolveSkillResourceProfile(skillId);
            return [
                skillId,
                {
                    ...def,
                    ...(metabolicBandProfile ? { metabolicBandProfile } : {}),
                    scenarios: def.scenarios || getSkillScenarios(skillId),
                    resourceProfile
                }
            ];
        })
    );
};

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
        deathDecalVariant: def.deathDecalVariant,
        energyCost: def.baseVariables.cost,
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
        const runtimeDef = getRuntimeSkillDefinition(skillId);
        if (runtimeDef) {
            const resolved = resolveSkillRuntime(runtimeDef, skill?.activeUpgrades || [], 'none');
            return resolved.runtime.baseVariables.range;
        }
        const heldPosition = !!(actor?.position && actor?.previousPosition && hexEquals(actor.previousPosition, actor.position));
        const resolved = resolveVirtualSkillDefinition(def, skill?.activeUpgrades || [], { heldPosition });
        return resolved.skill.baseVariables.range;
    }
};

export const SkillRegistry = new Proxy(SkillRegistryBase as Record<string, any>, {
    get(target, prop, receiver) {
        if (typeof prop === 'string' && prop in target) {
            return Reflect.get(target, prop, receiver);
        }
        if (typeof prop === 'string') {
            const registry = getMergedRegistry();
            if (prop in registry) return registry[prop];
        }
        return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
        if (typeof prop === 'string' && prop in target) return true;
        if (typeof prop === 'string') {
            return prop in getMergedRegistry();
        }
        return Reflect.has(target, prop);
    },
    ownKeys(target) {
        return [...new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(getMergedRegistry())])];
    },
    getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string' && prop in target) {
            return Object.getOwnPropertyDescriptor(target, prop);
        }
        if (typeof prop === 'string') {
            const registry = getMergedRegistry();
            if (prop in registry) {
                return {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: registry[prop]
                };
            }
        }
        return Object.getOwnPropertyDescriptor(target, prop);
    }
}) as typeof SkillRegistryBase & Record<string, any>;

/**
 * Get the dynamic range of a skill for an actor, including upgrades.
 */
export const getSkillRange = SkillRegistry.getSkillRange;

/**
 * Find a skill definition by ID.
 */
export const getSkillDefinition = (id: string): SkillDefinition | undefined => {
    return SkillRegistry.get(id);
};
