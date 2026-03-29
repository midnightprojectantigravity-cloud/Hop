import {
    MVP_ENEMY_CONTENT,
    type bestiaryEnemyType,
    type bestiaryWeightClass,
    type EnemybestiaryDefinition,
    type EnemySubtypeId,
} from './packs/mvp-enemy-content';

export type {
    bestiaryEnemyType,
    bestiaryWeightClass,
    EnemybestiaryDefinition,
    EnemySubtypeId,
};

const tobestiaryRecord = (): Record<EnemySubtypeId, EnemybestiaryDefinition> => {
    const entries = Object.entries(MVP_ENEMY_CONTENT).map(([subtype, entry]) => [subtype, entry.bestiary]);
    return Object.fromEntries(entries) as Record<EnemySubtypeId, EnemybestiaryDefinition>;
};

/**
 * Compatibility facade over canonical pack-backed enemy content.
 * Keep this API stable for legacy consumers while content ownership lives in `data/packs/*`.
 */
export const ENEMY_bestiary: Record<EnemySubtypeId, EnemybestiaryDefinition> = tobestiaryRecord();

export const getEnemybestiaryEntry = (subtype: string): EnemybestiaryDefinition | undefined =>
    (ENEMY_bestiary as Record<string, EnemybestiaryDefinition | undefined>)[subtype];

export const getEnemybestiarySkillLoadout = (
    subtype: string,
    options: { includePassive?: boolean } = {}
): string[] => {
    const def = getEnemybestiaryEntry(subtype);
    if (!def) return [];
    const includePassive = options.includePassive ?? true;
    return includePassive
        ? [...def.skills.base, ...def.skills.passive]
        : [...def.skills.base];
};

