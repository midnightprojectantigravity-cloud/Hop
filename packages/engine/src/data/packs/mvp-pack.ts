import type { BaseUnitDefinition, CompositeSkillDefinition, TacticalDataPack } from '../contracts';
import { getMvpEnemyContentEntry, type EnemySubtypeId } from './mvp-enemy-content';

type UnitWeightClass = 'Light' | 'Standard' | 'Heavy' | 'Anchored' | 'OuterWall';

const MASS_BY_WEIGHT: Record<UnitWeightClass, number> = {
    Light: 3,
    Standard: 5,
    Heavy: 8,
    Anchored: 12,
    OuterWall: 20
};

const createEnemyUnit = (config: {
    id: string;
    name: string;
    subtype: string;
    weightClass: UnitWeightClass;
    speed: number;
    trinity: { body: number; mind: number; instinct: number };
    baseSkills: string[];
    passiveSkills?: string[];
}): BaseUnitDefinition => ({
    version: '1.0.0',
    id: config.id,
    name: config.name,
    actorType: 'enemy',
    subtype: config.subtype,
    factionId: 'enemy',
    weightClass: config.weightClass,
    coordSpace: {
        system: 'cube-axial',
        pointFormat: 'qrs'
    },
    instantiate: {
        rngStream: 'enemy.instantiate',
        seedSalt: config.subtype,
        counterMode: 'consume_global',
        drawOrder: ['body', 'mind', 'instinct', 'speed', 'mass'],
        includeRollTrace: false
    },
    propensities: {
        body: {
            method: 'fixed',
            value: config.trinity.body
        },
        mind: {
            method: 'fixed',
            value: config.trinity.mind
        },
        instinct: {
            method: 'fixed',
            value: config.trinity.instinct
        },
        speed: {
            method: 'fixed',
            value: config.speed
        },
        mass: {
            method: 'fixed',
            value: MASS_BY_WEIGHT[config.weightClass]
        }
    },
    derivedStats: {
        maxHp: {
            formula: 'trinity_hp_v1'
        }
    },
    physics: {
        collisionPolicy: 'crush_damage',
        crushModel: {
            baseDamage: 0,
            impulseMultiplier: 1,
            massDivider: 1,
            minDamage: 1
        }
    },
    skillLoadout: {
        baseSkillIds: config.baseSkills,
        passiveSkillIds: config.passiveSkills || []
    },
    runtimeDefaults: {
        startingHp: 'maxHp',
        temporaryArmor: 0,
        isVisible: true
    }
});

const createEnemyUnitFromBestiary = (
    subtype: EnemySubtypeId
): BaseUnitDefinition => {
    const content = getMvpEnemyContentEntry(subtype);
    if (!content) throw new Error(`Missing MVP enemy content for ${subtype}`);
    const def = content.bestiary;
    return createEnemyUnit({
        id: content.packUnitId,
        name: def.name,
        subtype: def.subtype,
        weightClass: def.stats.weightClass as UnitWeightClass,
        speed: def.stats.speed,
        trinity: def.trinity,
        baseSkills: content.runtimeSkills.base,
        passiveSkills: content.runtimeSkills.passive
    });
};

const SHIELD_BASH_V1: CompositeSkillDefinition = {
    version: '1.0.0',
    id: 'SHIELD_BASH_V1',
    name: 'Shield Bash V1',
    description: 'Data-driven migration variant of shield bash.',
    slot: 'offensive',
    keywords: ['Momentum'],
    intentTags: ['damage', 'control', 'move'],
    targeting: {
        mode: 'single',
        range: 1,
        requiresLos: true,
        allowOccupied: true,
        deterministicSort: 'distance_then_q_then_r'
    },
    stackPolicy: {
        resolveOrder: 'LIFO',
        reactionWindow: 'automated',
        playerPriority: false,
        emitTickEvents: true
    },
    baseAction: {
        costs: {
            energy: 0,
            cooldown: 2,
            consumesTurn: true
        },
        effects: [
            {
                id: 'shield_bash_v1_force',
                kind: 'APPLY_FORCE',
                tags: ['movement', 'momentum'],
                target: { selector: 'targetActor' },
                force: {
                    mode: 'push',
                    direction: 'source_to_target',
                    magnitude: {
                        base: 2,
                        scaling: [{ stat: 'body', coefficient: 0.2 }],
                        min: 1,
                        round: 'floor'
                    },
                    maxDistance: 3,
                    collision: {
                        onBlocked: 'crush_damage',
                        crushDamage: {
                            base: 1,
                            scaling: [{ stat: 'momentum', coefficient: 1 }],
                            min: 1,
                            round: 'floor'
                        }
                    }
                }
            },
            {
                id: 'shield_bash_v1_damage',
                kind: 'DEAL_DAMAGE',
                tags: ['damage', 'physical'],
                target: { selector: 'targetActor' },
                amount: {
                    base: 2,
                    scaling: [{ stat: 'body', coefficient: 0.4 }],
                    min: 1,
                    round: 'floor'
                },
                damageClass: 'physical',
                reason: 'shield_bash_v1'
            }
        ]
    },
    reactivePassives: [],
    upgrades: [],
    inhibit: {
        filterMode: 'exclude_matching_tags',
        removableTags: ['movement', 'momentum']
    },
    preview: {
        dryRunEnabled: true,
        eventMap: {
            APPLY_FORCE: 'UnitMoved',
            DEAL_DAMAGE: 'DamageTaken'
        }
    }
};

export const TACTICAL_CORE_MVP_PACK: TacticalDataPack = {
    version: '1.0.0',
    units: [
        createEnemyUnitFromBestiary('footman'),
        createEnemyUnitFromBestiary('sprinter'),
        createEnemyUnitFromBestiary('raider'),
        createEnemyUnitFromBestiary('pouncer'),
        createEnemyUnitFromBestiary('shieldBearer'),
        createEnemyUnitFromBestiary('archer'),
        createEnemyUnitFromBestiary('bomber'),
        createEnemyUnitFromBestiary('warlock'),
        createEnemyUnitFromBestiary('sentinel')
    ],
    skills: [SHIELD_BASH_V1]
};
