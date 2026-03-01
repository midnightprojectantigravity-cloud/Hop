/**
 * STRATEGIC HUB & META SYSTEM
 * Handles character loadouts and persistence.
 * Goal: Meta - Allows for pre-game character customization.
 * TODO: Implement "Cloud Save" by integrating with an external database/API.
 */
import type { Skill, Actor } from '../types';
import { SkillRegistry, createActiveSkill } from '../skillRegistry';
import { DEFAULT_LOADOUT_DEFINITIONS } from '../data/loadouts/default-loadouts';
import { cloneLoadoutCatalog, parseLoadoutCatalog } from '../data/loadouts/parser';
import type { LoadoutDefinition } from '../data/loadouts/contracts';

export type Loadout = LoadoutDefinition;
export type { LoadoutDefinition };

const parsedDefaultLoadouts = parseLoadoutCatalog(DEFAULT_LOADOUT_DEFINITIONS);

/**
 * Default Loadouts for the "Strategic Hub" (data-driven source + runtime facade).
 */
export const DEFAULT_LOADOUTS: Record<string, Loadout> = cloneLoadoutCatalog(parsedDefaultLoadouts);

let defaultLoadoutsValidated = false;

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

// Fail fast during module import and keep an explicit validation seam for bootstrap/tests.
validateDefaultLoadouts();

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

/**
 * Apply a loadout to a set of player stats.
 */
export const applyLoadoutToPlayer = (loadout: Loadout): { upgrades: string[]; activeSkills: Skill[]; archetype: any } => {
    const activeSkills = loadout.startingSkills.map(s => createActiveSkill(s as any)).filter(Boolean) as Skill[];
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
