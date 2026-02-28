import {
    MVP_ENEMY_CONTENT,
    type EnemyBestiaryDefinition,
    type EnemySubtypeId,
    type MvpEnemyContentEntry,
} from '../packs/mvp-enemy-content';

export interface EnemyCatalogEntry extends MvpEnemyContentEntry {
    subtype: EnemySubtypeId;
}

const ENEMY_SUBTYPE_IDS = Object.keys(MVP_ENEMY_CONTENT) as EnemySubtypeId[];

const toCatalogEntry = (subtype: EnemySubtypeId): EnemyCatalogEntry => {
    const entry = MVP_ENEMY_CONTENT[subtype];
    return {
        subtype,
        ...entry,
    };
};

export const listEnemyCatalogEntries = (): EnemyCatalogEntry[] =>
    ENEMY_SUBTYPE_IDS.map(toCatalogEntry);

export const getEnemyCatalogEntry = (subtype: string): EnemyCatalogEntry | undefined => {
    const typedSubtype = subtype as EnemySubtypeId;
    if (!Object.prototype.hasOwnProperty.call(MVP_ENEMY_CONTENT, typedSubtype)) return undefined;
    return toCatalogEntry(typedSubtype);
};

export const getEnemyCatalogBestiaryEntry = (subtype: string): EnemyBestiaryDefinition | undefined =>
    getEnemyCatalogEntry(subtype)?.bestiary;

export const getEnemyCatalogSkillLoadout = (
    subtype: string,
    options: {
        includePassive?: boolean;
        source?: 'runtime' | 'bestiary';
    } = {}
): string[] => {
    const entry = getEnemyCatalogEntry(subtype);
    if (!entry) return [];
    const includePassive = options.includePassive ?? true;
    const source = options.source ?? 'runtime';
    const skills = source === 'runtime' ? entry.runtimeSkills : entry.bestiary.skills;
    return includePassive
        ? [...skills.base, ...skills.passive]
        : [...skills.base];
};

export const toLegacyEnemyStatsRecord = (): Record<string, {
    hp: number;
    maxHp: number;
    range: number;
    damage: number;
    type: EnemyBestiaryDefinition['stats']['type'];
    cost: number;
    skills: string[];
    actionCooldown: number;
    weightClass: EnemyBestiaryDefinition['stats']['weightClass'];
    speed: number;
}> => {
    const out: Record<string, {
        hp: number;
        maxHp: number;
        range: number;
        damage: number;
        type: EnemyBestiaryDefinition['stats']['type'];
        cost: number;
        skills: string[];
        actionCooldown: number;
        weightClass: EnemyBestiaryDefinition['stats']['weightClass'];
        speed: number;
    }> = {};

    for (const entry of listEnemyCatalogEntries()) {
        out[entry.subtype] = {
            hp: entry.bestiary.stats.hp,
            maxHp: entry.bestiary.stats.maxHp,
            range: entry.bestiary.stats.range,
            damage: entry.bestiary.stats.damage,
            type: entry.bestiary.stats.type,
            cost: entry.bestiary.stats.cost,
            skills: getEnemyCatalogSkillLoadout(entry.subtype, { source: 'runtime', includePassive: true }),
            actionCooldown: entry.bestiary.stats.actionCooldown,
            weightClass: entry.bestiary.stats.weightClass,
            speed: entry.bestiary.stats.speed,
        };
    }

    return out;
};

