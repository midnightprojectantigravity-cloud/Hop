import {
    MVP_ENEMY_CONTENT,
    type BestiaryEnemyType,
    type BestiaryWeightClass,
    type EnemyBestiaryDefinition,
    type EnemySubtypeId,
} from './packs/mvp-enemy-content';

export type {
    BestiaryEnemyType,
    BestiaryWeightClass,
    EnemyBestiaryDefinition,
    EnemySubtypeId,
};

const toBestiaryRecord = (): Record<EnemySubtypeId, EnemyBestiaryDefinition> => {
    const entries = Object.entries(MVP_ENEMY_CONTENT).map(([subtype, entry]) => [subtype, entry.bestiary]);
    return Object.fromEntries(entries) as Record<EnemySubtypeId, EnemyBestiaryDefinition>;
};

/**
 * Compatibility facade over canonical pack-backed enemy content.
 * Keep this API stable for legacy consumers while content ownership lives in `data/packs/*`.
 */
export const ENEMY_BESTIARY: Record<EnemySubtypeId, EnemyBestiaryDefinition> = toBestiaryRecord();

export const getEnemyBestiaryEntry = (subtype: string): EnemyBestiaryDefinition | undefined =>
    (ENEMY_BESTIARY as Record<string, EnemyBestiaryDefinition | undefined>)[subtype];

export const getEnemyBestiarySkillLoadout = (
    subtype: string,
    options: { includePassive?: boolean } = {}
): string[] => {
    const def = getEnemyBestiaryEntry(subtype);
    if (!def) return [];
    const includePassive = options.includePassive ?? true;
    return includePassive
        ? [...def.skills.base, ...def.skills.passive]
        : [...def.skills.base];
};

