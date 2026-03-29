import type { ArmorBurdenTier } from '../../types';

export type bestiaryWeightClass = 'Light' | 'Standard' | 'Heavy' | 'Anchored' | 'OuterWall';
export type bestiaryEnemyType = 'melee' | 'ranged' | 'boss';
export type EncounterRole = 'onboarding' | 'pressure_spike' | 'recovery' | 'elite' | 'boss';
export type EnemyCombatRole =
    | 'bruiser'
    | 'skirmisher'
    | 'shooter'
    | 'caster'
    | 'controller'
    | 'hazard_setter'
    | 'boss_anchor';
export type EnemyBalanceTag =
    | 'frontline'
    | 'flanker'
    | 'siege'
    | 'hazard'
    | 'summoner'
    | 'boss'
    | 'support';

export interface EnemyMetabolicContract {
    armorBurdenTier: ArmorBurdenTier;
    targetBaseBfiBand: readonly [number, number];
    targetEffectiveBfiBand: readonly [number, number];
}

export interface EnemySpawnContract {
    spawnRoleWeights: Partial<Record<EncounterRole, number>>;
}

export interface SpawnedHazardContract {
    spawnedEntityClass: 'ephemeral_hazard_actor';
    budgetContribution: number;
    radius: number;
    delayTurns: number;
}

export interface EnemyBalanceContract {
    combatRole: EnemyCombatRole;
    balanceTags: EnemyBalanceTag[];
    metabolicProfile: EnemyMetabolicContract;
    spawnProfile: EnemySpawnContract;
    spawnedHazardProfile?: SpawnedHazardContract;
}

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
        type: bestiaryEnemyType;
        cost: number;
        actionCooldown: number;
        weightClass: bestiaryWeightClass;
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
    runtimeSkills: {
        base: string[];
        passive: string[];
    };
    contract: EnemyBalanceContract;
}

export const MVP_ENEMY_CONTENT: Record<EnemySubtypeId, MvpEnemyContentEntry> = {
    footman: {
        packUnitId: 'ENEMY_FOOTMAN_V1',
        bestiary: {
            subtype: 'footman',
            name: 'Footman',
            stats: { hp: 93, maxHp: 93, range: 1, damage: 2, type: 'melee', cost: 2, actionCooldown: 2, weightClass: 'Standard', speed: 1 },
            trinity: { body: 12, mind: 3, instinct: 6 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK'], passive: ['AUTO_ATTACK'] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'BASIC_ATTACK'], passive: [] },
        contract: {
            combatRole: 'bruiser',
            balanceTags: ['frontline'],
            metabolicProfile: {
                armorBurdenTier: 'Medium',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [11, 11]
            },
            spawnProfile: {
                spawnRoleWeights: { onboarding: 5, recovery: 4, pressure_spike: 3, elite: 2 }
            }
        }
    },
    sprinter: {
        packUnitId: 'ENEMY_SPRINTER_V1',
        bestiary: {
            subtype: 'sprinter',
            name: 'Sprinter',
            stats: { hp: 81, maxHp: 81, range: 1, damage: 2, type: 'melee', cost: 2, actionCooldown: 1, weightClass: 'Light', speed: 2 },
            trinity: { body: 6, mind: 3, instinct: 14 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'BASIC_ATTACK'], passive: [] },
        contract: {
            combatRole: 'skirmisher',
            balanceTags: ['flanker'],
            metabolicProfile: {
                armorBurdenTier: 'Light',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [10, 10]
            },
            spawnProfile: {
                spawnRoleWeights: { onboarding: 2, pressure_spike: 4, elite: 2 }
            }
        }
    },
    raider: {
        packUnitId: 'ENEMY_RAIDER_V1',
        bestiary: {
            subtype: 'raider',
            name: 'Raider',
            stats: { hp: 91, maxHp: 91, range: 2, damage: 3, type: 'melee', cost: 3, actionCooldown: 1, weightClass: 'Light', speed: 2 },
            trinity: { body: 8, mind: 4, instinct: 13 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'DASH'], passive: [] }
        },
        runtimeSkills: { base: ['DASH'], passive: [] },
        contract: {
            combatRole: 'skirmisher',
            balanceTags: ['flanker'],
            metabolicProfile: {
                armorBurdenTier: 'Light',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [10, 10]
            },
            spawnProfile: {
                spawnRoleWeights: { pressure_spike: 4, elite: 3, recovery: 1 }
            }
        }
    },
    pouncer: {
        packUnitId: 'ENEMY_POUNCER_V1',
        bestiary: {
            subtype: 'pouncer',
            name: 'Pouncer',
            stats: { hp: 92, maxHp: 92, range: 2, damage: 2, type: 'melee', cost: 3, actionCooldown: 1, weightClass: 'Light', speed: 2 },
            trinity: { body: 7, mind: 5, instinct: 15 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'GRAPPLE_HOOK'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'GRAPPLE_HOOK'], passive: [] },
        contract: {
            combatRole: 'controller',
            balanceTags: ['flanker', 'support'],
            metabolicProfile: {
                armorBurdenTier: 'Light',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [10, 10]
            },
            spawnProfile: {
                spawnRoleWeights: { pressure_spike: 3, elite: 3, recovery: 2 }
            }
        }
    },
    shieldBearer: {
        packUnitId: 'ENEMY_SHIELDBEARER_V1',
        bestiary: {
            subtype: 'shieldBearer',
            name: 'Shield Bearer',
            stats: { hp: 115, maxHp: 115, range: 1, damage: 2, type: 'melee', cost: 4, actionCooldown: 2, weightClass: 'Heavy', speed: 1 },
            trinity: { body: 16, mind: 4, instinct: 5 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'SHIELD_BASH'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'SHIELD_BASH'], passive: [] },
        contract: {
            combatRole: 'bruiser',
            balanceTags: ['frontline'],
            metabolicProfile: {
                armorBurdenTier: 'Heavy',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [12, 12]
            },
            spawnProfile: {
                spawnRoleWeights: { recovery: 2, elite: 4, boss: 3 }
            }
        }
    },
    archer: {
        packUnitId: 'ENEMY_ARCHER_V1',
        bestiary: {
            subtype: 'archer',
            name: 'Archer',
            stats: { hp: 83, maxHp: 83, range: 4, damage: 3, type: 'ranged', cost: 3, actionCooldown: 2, weightClass: 'Light', speed: 1 },
            trinity: { body: 6, mind: 5, instinct: 14 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'ARCHER_SHOT'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'ARCHER_SHOT'], passive: [] },
        contract: {
            combatRole: 'shooter',
            balanceTags: ['siege'],
            metabolicProfile: {
                armorBurdenTier: 'Light',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [10, 10]
            },
            spawnProfile: {
                spawnRoleWeights: { recovery: 3, pressure_spike: 3, elite: 2, boss: 2 }
            }
        }
    },
    bomber: {
        packUnitId: 'ENEMY_BOMBER_V1',
        bestiary: {
            subtype: 'bomber',
            name: 'Bomber',
            stats: { hp: 60, maxHp: 60, range: 3, damage: 1, type: 'ranged', cost: 3, actionCooldown: 3, weightClass: 'Light', speed: 1 },
            trinity: { body: 4, mind: 6, instinct: 10 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'BOMB_TOSS'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'BOMB_TOSS'], passive: [] },
        contract: {
            combatRole: 'hazard_setter',
            balanceTags: ['hazard', 'siege'],
            metabolicProfile: {
                armorBurdenTier: 'None',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [9, 9]
            },
            spawnProfile: {
                spawnRoleWeights: { pressure_spike: 2, elite: 2, boss: 1 }
            },
            spawnedHazardProfile: {
                spawnedEntityClass: 'ephemeral_hazard_actor',
                budgetContribution: 2,
                radius: 1,
                delayTurns: 2
            }
        }
    },
    warlock: {
        packUnitId: 'ENEMY_WARLOCK_V1',
        bestiary: {
            subtype: 'warlock',
            name: 'Warlock',
            stats: { hp: 62, maxHp: 62, range: 4, damage: 3, type: 'ranged', cost: 4, actionCooldown: 3, weightClass: 'Light', speed: 1 },
            trinity: { body: 4, mind: 14, instinct: 8 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'FIREBALL'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'FIREBALL'], passive: [] },
        contract: {
            combatRole: 'caster',
            balanceTags: ['support', 'siege'],
            metabolicProfile: {
                armorBurdenTier: 'None',
                targetBaseBfiBand: [9, 9],
                targetEffectiveBfiBand: [9, 9]
            },
            spawnProfile: {
                spawnRoleWeights: { recovery: 1, elite: 3, boss: 3 }
            }
        }
    },
    sentinel: {
        packUnitId: 'ENEMY_SENTINEL_V1',
        bestiary: {
            subtype: 'sentinel',
            name: 'Sentinel',
            stats: { hp: 152, maxHp: 152, range: 4, damage: 4, type: 'boss', cost: 20, actionCooldown: 1, weightClass: 'Heavy', speed: 1 },
            trinity: { body: 18, mind: 14, instinct: 10 },
            skills: { base: ['BASIC_MOVE', 'BASIC_ATTACK', 'SENTINEL_BLAST'], passive: [] }
        },
        runtimeSkills: { base: ['BASIC_MOVE', 'SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'], passive: [] },
        contract: {
            combatRole: 'boss_anchor',
            balanceTags: ['frontline', 'boss', 'siege'],
            metabolicProfile: {
                armorBurdenTier: 'Heavy',
                targetBaseBfiBand: [8, 8],
                targetEffectiveBfiBand: [11, 11]
            },
            spawnProfile: {
                spawnRoleWeights: { boss: 5 }
            }
        }
    }
};

export const getMvpEnemyContentEntry = (subtype: string): MvpEnemyContentEntry | undefined =>
    (MVP_ENEMY_CONTENT as Record<string, MvpEnemyContentEntry | undefined>)[subtype];
