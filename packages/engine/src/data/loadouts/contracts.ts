export interface LoadoutDefinition {
    id: string;
    name: string;
    description: string;
    startingUpgrades: string[];
    startingSkills: string[];
}

export type LoadoutCatalog = Record<string, LoadoutDefinition>;

