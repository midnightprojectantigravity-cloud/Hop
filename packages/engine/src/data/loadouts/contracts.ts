import type { AiBehaviorOverlay } from '../../types';

export interface LoadoutDefinition {
    id: string;
    name: string;
    description: string;
    startingUpgrades: string[];
    startingSkills: string[];
    behaviorOverlay?: AiBehaviorOverlay;
}

export type LoadoutCatalog = Record<string, LoadoutDefinition>;
