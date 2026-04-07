import type { ArmorBurdenTier, WeightClass } from '../../types';
import type { TrinityStats } from '../../systems/combat/trinity-resolver';
import type { CombatProfile } from '../../systems/combat/combat-traits';

export type CompanionSubtypeId = 'falcon' | 'skeleton';
export type CompanionRole = 'utility_predator' | 'attrition_body';
export type CompanionPowerBudgetClass = 'utility_light' | 'support_medium' | 'summon_swarm';

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
        evaluationExcludedFromEnemyBudget: true
    },
    skeleton: {
        subtype: 'skeleton',
        role: 'attrition_body',
        powerBudgetClass: 'summon_swarm',
        weightClass: 'Standard',
        armorBurdenTier: 'Medium',
        trinity: { body: 12, mind: 2, instinct: 4 },
        speed: 50,
        hp: 86,
        maxHp: 86,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK'],
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
