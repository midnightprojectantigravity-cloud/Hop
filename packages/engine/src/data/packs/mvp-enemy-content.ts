export type BestiaryWeightClass = 'Light' | 'Standard' | 'Heavy' | 'Anchored' | 'OuterWall';
export type BestiaryEnemyType = 'melee' | 'ranged' | 'boss';

export type EnemySubtypeId =
    | 'footman'
    | 'sprinter'
    | 'raider'
    | 'pouncer'
    | 'shieldBearer'
    | 'archer'
    | 'bomber'
    | 'warlock'
    | 'sentinel';

export interface EnemyBestiaryDefinition {
    subtype: EnemySubtypeId;
    name: string;
    stats: {
        hp: number;
        maxHp: number;
        range: number;
        damage: number;
        type: BestiaryEnemyType;
        cost: number;
        actionCooldown: number;
        weightClass: BestiaryWeightClass;
        speed: number;
    };
    trinity: {
        body: number;
        mind: number;
        instinct: number;
    };
    skills: {
        base: string[];
        passive: string[];
    };
}

export interface MvpEnemyContentEntry {
    packUnitId: string;
    bestiary: EnemyBestiaryDefinition;
}

export const MVP_ENEMY_CONTENT: Record<EnemySubtypeId, MvpEnemyContentEntry> = {
    footman: {
        packUnitId: 'ENEMY_FOOTMAN_V1',
        bestiary: {
            subtype: 'footman',
            name: 'Footman',
            stats: { hp: 1, maxHp: 1, range: 1, damage: 1, type: 'melee', cost: 1, actionCooldown: 2, weightClass: 'Standard', speed: 1 },
            trinity: { body: 4, mind: 0, instinct: 0 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK'], passive: ['AUTO_ATTACK'] }
        }
    },
    sprinter: {
        packUnitId: 'ENEMY_SPRINTER_V1',
        bestiary: {
            subtype: 'sprinter',
            name: 'Sprinter',
            stats: { hp: 1, maxHp: 1, range: 1, damage: 1, type: 'melee', cost: 1, actionCooldown: 1, weightClass: 'Standard', speed: 2 },
            trinity: { body: 2, mind: 0, instinct: 0 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK'], passive: [] }
        }
    },
    raider: {
        packUnitId: 'ENEMY_RAIDER_V1',
        bestiary: {
            subtype: 'raider',
            name: 'Raider',
            stats: { hp: 1, maxHp: 1, range: 4, damage: 1, type: 'melee', cost: 2, actionCooldown: 1, weightClass: 'Standard', speed: 1 },
            trinity: { body: 2, mind: 0, instinct: 1 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'DASH'], passive: [] }
        }
    },
    pouncer: {
        packUnitId: 'ENEMY_POUNCER_V1',
        bestiary: {
            subtype: 'pouncer',
            name: 'Pouncer',
            stats: { hp: 1, maxHp: 1, range: 4, damage: 1, type: 'melee', cost: 2, actionCooldown: 1, weightClass: 'Standard', speed: 1 },
            trinity: { body: 2, mind: 0, instinct: 1 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'GRAPPLE_HOOK'], passive: [] }
        }
    },
    shieldBearer: {
        packUnitId: 'ENEMY_SHIELDBEARER_V1',
        bestiary: {
            subtype: 'shieldBearer',
            name: 'Shield Bearer',
            stats: { hp: 2, maxHp: 2, range: 1, damage: 1, type: 'melee', cost: 2, actionCooldown: 2, weightClass: 'Heavy', speed: 1 },
            trinity: { body: 1, mind: 0, instinct: 0.4 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'SHIELD_BASH'], passive: [] }
        }
    },
    archer: {
        packUnitId: 'ENEMY_ARCHER_V1',
        bestiary: {
            subtype: 'archer',
            name: 'Archer',
            stats: { hp: 1, maxHp: 1, range: 4, damage: 1, type: 'ranged', cost: 1, actionCooldown: 3, weightClass: 'Standard', speed: 1 },
            trinity: { body: 0.2, mind: 0, instinct: 0.2 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'ARCHER_SHOT'], passive: [] }
        }
    },
    bomber: {
        packUnitId: 'ENEMY_BOMBER_V1',
        bestiary: {
            subtype: 'bomber',
            name: 'Bomber',
            stats: { hp: 1, maxHp: 1, range: 3, damage: 1, type: 'ranged', cost: 1, actionCooldown: 2, weightClass: 'Standard', speed: 1 },
            trinity: { body: 0.4, mind: 0.2, instinct: 0.2 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'BOMB_TOSS'], passive: [] }
        }
    },
    warlock: {
        packUnitId: 'ENEMY_WARLOCK_V1',
        bestiary: {
            subtype: 'warlock',
            name: 'Warlock',
            stats: { hp: 1, maxHp: 1, range: 4, damage: 1, type: 'ranged', cost: 2, actionCooldown: 2, weightClass: 'Standard', speed: 1 },
            trinity: { body: 0.4, mind: 0.6, instinct: 0.2 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'SENTINEL_BLAST'], passive: [] }
        }
    },
    sentinel: {
        packUnitId: 'ENEMY_SENTINEL_V1',
        bestiary: {
            subtype: 'sentinel',
            name: 'Sentinel',
            stats: { hp: 30, maxHp: 30, range: 4, damage: 2, type: 'boss', cost: 25, actionCooldown: 1, weightClass: 'Heavy', speed: 1 },
            trinity: { body: 4, mind: 2, instinct: 2 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'SENTINEL_BLAST'], passive: [] }
        }
    }
};

export const getMvpEnemyContentEntry = (subtype: string): MvpEnemyContentEntry | undefined =>
    (MVP_ENEMY_CONTENT as Record<string, MvpEnemyContentEntry | undefined>)[subtype];

