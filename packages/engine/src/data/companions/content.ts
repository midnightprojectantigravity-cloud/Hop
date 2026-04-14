import type { ArmorBurdenTier, WeightClass } from '../../types';
import type { AiBehaviorOverlayInstance } from '../../types';
import type { TrinityStats } from '../../systems/combat/trinity-resolver';
import type { CombatProfile } from '../../systems/combat/combat-traits';

export type CompanionSubtypeId = 'falcon' | 'skeleton';
export type CompanionRole = 'utility_predator' | 'attrition_body';
export type CompanionPowerBudgetClass = 'utility_light' | 'support_medium' | 'summon_swarm';
export type CompanionModeId = 'roost' | 'scout' | 'predator';

export interface CompanionModeDefinition {
    id: CompanionModeId;
    commandName: string;
    commandDescription: string;
    overlay: AiBehaviorOverlayInstance;
    anchor: 'owner' | 'point' | 'actor';
}

export interface CompanionBalanceEntry {
    subtype: CompanionSubtypeId;
    role: CompanionRole;
    powerBudgetClass: CompanionPowerBudgetClass;
    weightClass: WeightClass;
    armorBurdenTier: ArmorBurdenTier;
    trinity: TrinityStats;
    speed: number;
    hp: number;
    maxHp: number;
    skills: string[];
    combatProfile: CombatProfile;
    evaluationExcludedFromEnemyBudget: boolean;
    modes?: Partial<Record<CompanionModeId, CompanionModeDefinition>>;
}

export const COMPANION_BALANCE_CONTENT: Record<CompanionSubtypeId, CompanionBalanceEntry> = {
    falcon: {
        subtype: 'falcon',
        role: 'utility_predator',
        powerBudgetClass: 'utility_light',
        weightClass: 'Light',
        armorBurdenTier: 'None',
        trinity: { body: 4, mind: 6, instinct: 18 },
        speed: 95,
        hp: 84,
        maxHp: 84,
        skills: ['BASIC_MOVE', 'FALCON_PECK', 'FALCON_APEX_STRIKE', 'FALCON_HEAL', 'FALCON_SCOUT', 'FALCON_AUTO_ROOST'],
        combatProfile: {
            outgoingPhysical: 1.2,
            outgoingMagical: 1,
            incomingPhysical: 1,
            incomingMagical: 1
        },
        evaluationExcludedFromEnemyBudget: true,
        modes: {
            roost: {
                id: 'roost',
                commandName: 'Falcon: Roost',
                commandDescription: 'Falcon returns to you. Heals and cleanses 1 debuff on arrival.',
                overlay: {
                    id: 'falcon_roost',
                    source: 'command',
                    sourceId: 'falcon_roost',
                    rangeModel: 'owner_proximity',
                    selfPreservationBias: 0.35,
                    controlBias: 0.2,
                    commitBias: -0.3
                },
                anchor: 'owner'
            },
            scout: {
                id: 'scout',
                commandName: 'Falcon: Scout',
                commandDescription: 'Click tile to set patrol zone. Falcon orbits and attacks nearby enemies.',
                overlay: {
                    id: 'falcon_scout',
                    source: 'command',
                    sourceId: 'falcon_scout',
                    rangeModel: 'anchor_proximity',
                    controlBias: 0.35,
                    selfPreservationBias: 0.15,
                    commitBias: -0.1
                },
                anchor: 'point'
            },
            predator: {
                id: 'predator',
                commandName: 'Falcon: Hunt',
                commandDescription: 'Click enemy to mark as prey. Falcon pursues and uses Apex Strike.',
                overlay: {
                    id: 'falcon_predator',
                    source: 'command',
                    sourceId: 'falcon_predator',
                    desiredRange: [1, 2],
                    offenseBias: 0.35,
                    commitBias: 0.3,
                    preferDamageOverPositioning: true
                },
                anchor: 'actor'
            }
        }
    },
    skeleton: {
        subtype: 'skeleton',
        role: 'attrition_body',
        powerBudgetClass: 'summon_swarm',
        weightClass: 'Standard',
        armorBurdenTier: 'Medium',
        trinity: { body: 12, mind: 2, instinct: 6 },
        speed: 50,
        hp: 86,
        maxHp: 86,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        combatProfile: {
            outgoingPhysical: 1.1,
            outgoingMagical: 1,
            incomingPhysical: 1,
            incomingMagical: 1
        },
        evaluationExcludedFromEnemyBudget: true
    }
};

export const getCompanionBalanceEntry = (subtype: string): CompanionBalanceEntry | undefined =>
    (COMPANION_BALANCE_CONTENT as Record<string, CompanionBalanceEntry | undefined>)[subtype];

export const listCompanionBalanceEntries = (): CompanionBalanceEntry[] =>
    Object.values(COMPANION_BALANCE_CONTENT);

export const getCompanionModeDefinition = (
    subtype: CompanionSubtypeId,
    mode: CompanionModeId
): CompanionModeDefinition | undefined => COMPANION_BALANCE_CONTENT[subtype].modes?.[mode];
