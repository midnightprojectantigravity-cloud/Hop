/**
 * STRATEGIC HUB & META SYSTEM
 * Handles character loadouts and persistence.
 * Goal: Meta - Allows for pre-game character customization.
 * TODO: Implement "Cloud Save" by integrating with an external database/API.
 */
import type { Skill, Actor } from '../types';
import type { ArchetypeID, SkillID } from '../types/registry';
import { SkillRegistry, createActiveSkill } from '../skillRegistry';
import { DEFAULT_LOADOUT_DEFINITIONS } from '../data/loadouts/default-loadouts';
import { parseLoadoutCatalog } from '../data/loadouts/parser';
import type { LoadoutDefinition } from '../data/loadouts/contracts';

export type Loadout = LoadoutDefinition;
export type { LoadoutDefinition };

const cloneDefaultLoadouts = (
    definitions: Record<string, LoadoutDefinition>
): Record<string, Loadout> =>
    Object.fromEntries(
        Object.entries(definitions).map(([id, value]) => [
            id,
            {
                ...value,
                startingSkills: [...value.startingSkills],
                startingUpgrades: [...value.startingUpgrades]
            }
        ])
    );

/**
 * Default Loadouts for the "Strategic Hub" (data-driven source + runtime facade).
 */
export const DEFAULT_LOADOUTS: Record<string, Loadout> = cloneDefaultLoadouts(
    DEFAULT_LOADOUT_DEFINITIONS as Record<string, LoadoutDefinition>
);

let defaultLoadoutsValidated = false;
let defaultLoadoutSchemaValidated = false;

export interface LoadoutRegistryValidationIssue {
    loadoutId: string;
    field: 'startingSkills' | 'startingUpgrades';
    value: string;
    message: string;
}

export const validateLoadoutCatalogAgainstSkillRegistry = (
    loadouts: Record<string, Loadout> = DEFAULT_LOADOUTS
): LoadoutRegistryValidationIssue[] => {
    const issues: LoadoutRegistryValidationIssue[] = [];
    for (const [loadoutId, loadout] of Object.entries(loadouts)) {
        for (const skillId of loadout.startingSkills) {
            if (!SkillRegistry.get(skillId)) {
                issues.push({
                    loadoutId,
                    field: 'startingSkills',
                    value: skillId,
                    message: `Unknown skill "${skillId}"`
                });
            }
        }
        for (const upgradeId of loadout.startingUpgrades) {
            if (!SkillRegistry.getUpgrade(upgradeId)) {
                issues.push({
                    loadoutId,
                    field: 'startingUpgrades',
                    value: upgradeId,
                    message: `Unknown upgrade "${upgradeId}"`
                });
            }
        }
    }
    return issues;
};

export const validateDefaultLoadouts = (): number => {
    if (defaultLoadoutsValidated) return Object.keys(DEFAULT_LOADOUTS).length;
    if (!defaultLoadoutSchemaValidated) {
        // Keep schema validation explicit but lazy to avoid import-time circular init hazards in bundled builds.
        parseLoadoutCatalog(DEFAULT_LOADOUT_DEFINITIONS);
        defaultLoadoutSchemaValidated = true;
    }
    const issues = validateLoadoutCatalogAgainstSkillRegistry(DEFAULT_LOADOUTS);
    if (issues.length > 0) {
        const message = issues
            .map(i => `${i.loadoutId}.${i.field}: ${i.message}`)
            .join(' | ');
        throw new Error(`Default loadout validation failed: ${message}`);
    }
    defaultLoadoutsValidated = true;
    return Object.keys(DEFAULT_LOADOUTS).length;
};

/**
 * Serialize a loadout to JSON for storage.
 */
export const serializeLoadout = (loadout: Loadout): string => {
    return JSON.stringify(loadout);
};

/**
 * Deserialize a loadout from JSON.
 */
export const deserializeLoadout = (json: string): Loadout => {
    return JSON.parse(json);
};

const LOADOUT_CAPABILITY_PASSIVES: Readonly<Partial<Record<ArchetypeID, readonly SkillID[]>>> = {
    VANGUARD: ['STANDARD_VISION', 'BASIC_AWARENESS', 'BURROW'],
    SKIRMISHER: ['STANDARD_VISION', 'BASIC_AWARENESS', 'TACTICAL_INSIGHT', 'FLIGHT'],
    FIREMAGE: ['STANDARD_VISION', 'BASIC_AWARENESS', 'COMBAT_ANALYSIS', 'FLIGHT'],
    NECROMANCER: ['STANDARD_VISION', 'BASIC_AWARENESS', 'COMBAT_ANALYSIS', 'BURROW'],
    HUNTER: ['STANDARD_VISION', 'BASIC_AWARENESS', 'TACTICAL_INSIGHT', 'BURROW'],
    ASSASSIN: ['STANDARD_VISION', 'BASIC_AWARENESS', 'TACTICAL_INSIGHT', 'PHASE_STEP']
};

const getCapabilityPassivesForLoadout = (loadout: Loadout): SkillID[] =>
    [...(LOADOUT_CAPABILITY_PASSIVES[loadout.id as ArchetypeID] || [])];

/**
 * Deterministically add/remove rollout-gated capability passives for a loadout.
 */
export const reconcileLoadoutCapabilityPassives = (
    loadout: Loadout,
    activeSkills: Skill[] = [],
    enabled: boolean
): Skill[] => {
    const capabilityPassives = getCapabilityPassivesForLoadout(loadout);
    if (capabilityPassives.length === 0) return activeSkills;

    if (!enabled) {
        const removable = new Set(capabilityPassives);
        const filtered = activeSkills.filter(skill => !removable.has(skill.id as SkillID));
        return filtered.length === activeSkills.length ? activeSkills : filtered;
    }

    const existing = new Set(activeSkills.map(skill => skill.id));
    let nextSkills = activeSkills;
    for (const skillId of capabilityPassives) {
        if (existing.has(skillId)) continue;
        const created = createActiveSkill(skillId) as Skill | null;
        if (!created) continue;
        if (nextSkills === activeSkills) {
            nextSkills = [...activeSkills];
        }
        nextSkills.push(created);
        existing.add(skillId);
    }
    return nextSkills;
};

export interface ApplyLoadoutOptions {
    capabilityPassivesEnabled?: boolean;
}

/**
 * Apply a loadout to a set of player stats.
 */
export const applyLoadoutToPlayer = (
    loadout: Loadout,
    options: ApplyLoadoutOptions = {}
): { upgrades: string[]; activeSkills: Skill[]; archetype: any } => {
    const baseSkills = loadout.startingSkills.map(s => createActiveSkill(s as any)).filter(Boolean) as Skill[];
    const activeSkills = options.capabilityPassivesEnabled === undefined
        ? baseSkills
        : reconcileLoadoutCapabilityPassives(loadout, baseSkills, options.capabilityPassivesEnabled);
    const archetype = loadout.id;
    return {
        upgrades: [...loadout.startingUpgrades],
        activeSkills,
        archetype
    };
};

const hasMovementSkill = (skills: Skill[]): boolean =>
    skills.some(s => s.id === 'BASIC_MOVE' || s.id === 'DASH');

/**
 * Guard against stale saves / migrations that accidentally strip movement passives.
 */
export const ensureMobilitySkill = (skills: Skill[] = []): Skill[] => {
    if (hasMovementSkill(skills)) return skills;
    const fallback = createActiveSkill('BASIC_MOVE') as Skill | null;
    return fallback ? [fallback, ...skills] : skills;
};

/**
 * World-state integrity helper for player actors loaded from snapshots/replays.
 */
export const ensurePlayerLoadoutIntegrity = (player: Actor): Actor => {
    const currentSkills = player.activeSkills || [];
    const normalizedSkills = ensureMobilitySkill(currentSkills);
    if (normalizedSkills === currentSkills) {
        return player;
    }

    return {
        ...player,
        activeSkills: normalizedSkills,
    };
};
