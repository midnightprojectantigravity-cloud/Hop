import type { BaseUnitDefinition } from '../contracts';
import { DEFAULT_LOADOUT_DEFINITIONS } from '../loadouts/default-loadouts';
import { getTrinityProfile } from '../../systems/combat/trinity-profiles';
import { getCompanionBalanceEntry, type CompanionSubtypeId } from '../companions/content';

const buildPlayerUnitDefinition = (archetype: string): BaseUnitDefinition => {
    const loadout = DEFAULT_LOADOUT_DEFINITIONS[archetype.toUpperCase()] || DEFAULT_LOADOUT_DEFINITIONS.VANGUARD;
    const profile = getTrinityProfile();
    const trinity = profile.archetype[archetype.toUpperCase()] || profile.default;
    return {
        version: '1.0.0',
        id: `PLAYER_${archetype.toUpperCase()}`,
        name: archetype,
        actorType: 'player',
        unitKind: 'archetype',
        subtype: archetype.toUpperCase(),
        factionId: 'player',
        weightClass: 'Standard',
        coordSpace: {
            system: 'cube-axial',
            pointFormat: 'qrs'
        },
        tags: ['player', 'archetype'],
        traits: ['PLAYER'],
        instantiate: {
            rngStream: 'player.instantiate',
            seedSalt: archetype.toLowerCase(),
            counterMode: 'consume_global',
            drawOrder: ['body', 'mind', 'instinct', 'speed', 'mass'],
            includeRollTrace: false
        },
        propensities: {
            body: { method: 'fixed', value: trinity.body },
            mind: { method: 'fixed', value: trinity.mind },
            instinct: { method: 'fixed', value: trinity.instinct },
            speed: { method: 'fixed', value: 1 },
            mass: { method: 'fixed', value: 5 }
        },
        derivedStats: {
            maxHp: { formulaId: 'trinity_hp_v1' }
        },
        skillLoadout: {
            baseSkillIds: [...loadout.startingSkills],
            passiveSkillIds: []
        },
        runtimeDefaults: {
            startingHp: 'maxHp',
            isVisible: true,
            temporaryArmor: 0
        }
    };
};

const buildCompanionUnitDefinition = (companionType: CompanionSubtypeId): BaseUnitDefinition => {
    const contract = getCompanionBalanceEntry(companionType);
    if (!contract) {
        throw new Error(`Unknown companion type "${companionType}"`);
    }
    const lifecycle = companionType === 'falcon'
        ? {
            companionState: { mode: 'roost' as const },
            behaviorState: {
                overlays: [{
                    id: 'falcon_roost',
                    source: 'summon' as const,
                    sourceId: 'falcon_roost',
                    rangeModel: 'owner_proximity' as const,
                    selfPreservationBias: 0.35,
                    controlBias: 0.2,
                    commitBias: -0.3
                }],
                anchorActorId: 'owner',
                controller: 'generic_ai' as const
            },
            isFlying: true
        }
        : {
            behaviorState: {
                overlays: [],
                controller: 'generic_ai' as const
            }
        };

    return {
        version: '1.0.0',
        id: `COMPANION_${companionType.toUpperCase()}`,
        name: companionType,
        actorType: 'enemy',
        unitKind: 'companion',
        subtype: companionType,
        factionId: 'player',
        weightClass: contract.weightClass,
        coordSpace: {
            system: 'cube-axial',
            pointFormat: 'qrs'
        },
        tags: ['companion'],
        traits: ['COMPANION', companionType.toUpperCase()],
        instantiate: {
            rngStream: 'companion.instantiate',
            seedSalt: companionType,
            counterMode: 'consume_global',
            drawOrder: ['body', 'mind', 'instinct', 'speed', 'mass'],
            includeRollTrace: false
        },
        propensities: {
            body: { method: 'fixed', value: contract.trinity.body },
            mind: { method: 'fixed', value: contract.trinity.mind },
            instinct: { method: 'fixed', value: contract.trinity.instinct },
            speed: { method: 'fixed', value: contract.speed },
            mass: { method: 'fixed', value: contract.weightClass === 'Light' ? 3 : 5 }
        },
        derivedStats: {
            maxHp: { formulaId: 'trinity_hp_v1' }
        },
        combatProfile: contract.combatProfile,
        skillLoadout: {
            baseSkillIds: [...contract.skills],
            passiveSkillIds: companionType === 'skeleton' ? ['ENEMY_AWARENESS'] : []
        },
        lifecycle,
        runtimeDefaults: {
            startingHp: 'maxHp',
            temporaryArmor: 0,
            isVisible: true
        }
    };
};

export const CORE_UNIT_DEFINITIONS: BaseUnitDefinition[] = [
    buildPlayerUnitDefinition('VANGUARD'),
    buildPlayerUnitDefinition('SKIRMISHER'),
    buildPlayerUnitDefinition('FIREMAGE'),
    buildPlayerUnitDefinition('NECROMANCER'),
    buildPlayerUnitDefinition('HUNTER'),
    buildPlayerUnitDefinition('ASSASSIN'),
    buildCompanionUnitDefinition('falcon'),
    buildCompanionUnitDefinition('skeleton')
];

export const getCoreUnitDefinitionBySubtype = (subtype: string): BaseUnitDefinition | undefined =>
    CORE_UNIT_DEFINITIONS.find(def => def.subtype === subtype || def.id === subtype || def.id === `PLAYER_${subtype}` || def.id === `COMPANION_${subtype.toUpperCase()}`);

export const listCoreUnitDefinitions = (): BaseUnitDefinition[] => [...CORE_UNIT_DEFINITIONS];
