import type { Actor } from '../types';
import type { StatusID } from '../types/registry';
import type { TrinityComponent, StatsComponent } from './components';
import { getComponent } from './components';
import {
    resolveTrinityLevers,
    computeSparkCostFromTrinity,
    type TrinityStats
} from './trinity-resolver';
export type { TrinityStats } from './trinity-resolver';

export type CombatAttribute = 'body' | 'mind' | 'instinct';

export interface CombatScalingTerm {
    attribute: CombatAttribute;
    coefficient: number;
}

export interface CombatStatusMultiplier {
    id: StatusID | string;
    multiplier: number;
}

export interface CombatIntent {
    attackerId: string;
    targetId: string;
    skillId: string;
    basePower: number;
    trinity: TrinityStats;
    scaling: CombatScalingTerm[];
    statusMultipliers: CombatStatusMultiplier[];
    damageClass?: 'physical' | 'magical';
    targetTrinity?: TrinityStats;
    interactionModel?: 'legacy' | 'triangle';
    inDangerPreviewHex?: boolean;
    proximityDistance?: number;
    theoreticalMaxPower?: number;
}

export interface CombatScoreEvent {
    skillId: string;
    attackerId: string;
    targetId: string;
    efficiency: number;
    riskBonusApplied: boolean;
    damageClass: 'physical' | 'magical';
    hitPressure: number;
    mitigationPressure: number;
    critPressure: number;
    resistancePressure: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
}

export interface CombatCalculationResult {
    basePower: number;
    bodyScaledPower: number;
    scalingPower: number;
    statusMultiplier: number;
    riskMultiplier: number;
    criticalMultiplier: number;
    hitMultiplier: number;
    mitigationMultiplier: number;
    critExpectedMultiplier: number;
    finalPower: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
    scoreEvent: CombatScoreEvent;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const readCombatInteractionModelEnv = (): string | undefined => {
    const maybeProcess = (globalThis as any)?.process;
    return maybeProcess?.env?.HOP_COMBAT_INTERACTION_MODEL;
};

const computeStatusMultiplier = (multipliers: CombatStatusMultiplier[]): number => {
    if (multipliers.length === 0) return 1;
    return multipliers.reduce((acc, m) => acc * m.multiplier, 1);
};

const computeRiskMultiplier = (intent: CombatIntent): number => {
    let risk = 1;
    if (intent.inDangerPreviewHex) {
        risk += 0.15;
    }

    if (typeof intent.proximityDistance === 'number') {
        const bounded = clamp(intent.proximityDistance, 0, 6);
        risk += (6 - bounded) * 0.02;
    }

    return risk;
};

const computeHitMultiplier = (
    attacker: TrinityStats,
    defender: TrinityStats | undefined,
    damageClass: 'physical' | 'magical'
): { multiplier: number; pressure: number } => {
    if (!defender) return { multiplier: 1, pressure: 0 };

    const atkAccuracy = damageClass === 'physical'
        ? (0.85 + attacker.instinct * 0.015 + attacker.body * 0.005)
        : (0.85 + attacker.mind * 0.015 + attacker.instinct * 0.005);

    const defEvasion = damageClass === 'physical'
        ? (defender.instinct * 0.012 + defender.body * 0.004)
        : (defender.instinct * 0.008 + defender.mind * 0.008);

    const hitChance = clamp(atkAccuracy - defEvasion, 0.1, 0.99);
    return { multiplier: hitChance, pressure: round3(atkAccuracy - defEvasion) };
};

const computeMitigationMultiplier = (
    defender: TrinityStats | undefined,
    damageClass: 'physical' | 'magical'
): { multiplier: number; pressure: number } => {
    if (!defender) return { multiplier: 1, pressure: 0 };
    const mitigation = damageClass === 'physical'
        ? clamp(defender.body * 0.01 + defender.instinct * 0.004, 0, 0.75)
        : clamp(defender.mind * 0.01 + defender.instinct * 0.004, 0, 0.75);
    return { multiplier: 1 - mitigation, pressure: round3(mitigation) };
};

const computeCritExpectedMultiplier = (
    attacker: TrinityStats,
    defender: TrinityStats | undefined,
    damageClass: 'physical' | 'magical',
    criticalMultiplier: number
): { multiplier: number; critPressure: number; resistancePressure: number } => {
    if (!defender) return { multiplier: criticalMultiplier, critPressure: 0, resistancePressure: 0 };

    const attackCritChance = damageClass === 'physical'
        ? clamp(0.05 + attacker.instinct * 0.01, 0, 0.75)
        : clamp(0.05 + attacker.mind * 0.01, 0, 0.75);

    const critResilience = damageClass === 'physical'
        ? clamp(defender.body * 0.006 + defender.instinct * 0.004, 0, 0.7)
        : clamp(defender.mind * 0.006 + defender.instinct * 0.004, 0, 0.7);

    const netCritChance = clamp(attackCritChance - critResilience, 0, 0.75);
    const expectedMultiplier = 1 + netCritChance * (criticalMultiplier - 1);
    return {
        multiplier: expectedMultiplier,
        critPressure: round3(attackCritChance),
        resistancePressure: round3(critResilience)
    };
};

const computeTrinityContributions = (
    intent: CombatIntent,
    levers: ReturnType<typeof resolveTrinityLevers>,
    bodyScaledPower: number,
    scalingPower: number,
    criticalMultiplier: number
): { body: number; mind: number; instinct: number } => {
    const bodyScaling = intent.scaling
        .filter(term => term.attribute === 'body')
        .reduce((acc, term) => acc + (intent.trinity.body || 0) * term.coefficient, 0);
    const mindScaling = intent.scaling
        .filter(term => term.attribute === 'mind')
        .reduce((acc, term) => acc + (intent.trinity.mind || 0) * term.coefficient, 0);
    const instinctScaling = intent.scaling
        .filter(term => term.attribute === 'instinct')
        .reduce((acc, term) => acc + (intent.trinity.instinct || 0) * term.coefficient, 0);

    const bodyPrimary = intent.damageClass === 'physical'
        ? Math.max(0, intent.basePower * (levers.bodyDamageMultiplier - 1))
        : 0;
    const mindPrimary = intent.damageClass === 'magical'
        ? Math.max(0, intent.basePower * (levers.mindMagicMultiplier - 1))
        : 0;
    const instinctCritLift = Math.max(0, (criticalMultiplier - 1) * (bodyScaledPower + scalingPower));

    return {
        body: Math.max(0, bodyPrimary + bodyScaling),
        mind: Math.max(0, mindPrimary + mindScaling),
        instinct: Math.max(0, instinctScaling + instinctCritLift),
    };
};

export const computeStatusDuration = (baseDuration: number, trinity: TrinityStats): number => {
    if (baseDuration <= 0) return baseDuration;
    const bonus = resolveTrinityLevers(trinity).mindStatusDurationBonus;
    return baseDuration + bonus;
};

export const computeInitiativeBonus = (trinity: TrinityStats): number => {
    return resolveTrinityLevers(trinity).instinctInitiativeBonus;
};

export const computeCriticalMultiplier = (trinity: TrinityStats): number => {
    return resolveTrinityLevers(trinity).instinctCriticalMultiplier;
};

export const computeSparkCost = (moveIndex: number, trinity: TrinityStats): number => {
    return computeSparkCostFromTrinity(moveIndex, trinity);
};

export const calculateCombat = (intent: CombatIntent): CombatCalculationResult => {
    const levers = resolveTrinityLevers(intent.trinity);
    const damageClass = intent.damageClass || 'physical';
    const defaultInteractionModel: 'legacy' | 'triangle' =
        readCombatInteractionModelEnv() === 'triangle' ? 'triangle' : 'legacy';
    const interactionModel = intent.interactionModel || defaultInteractionModel;

    // Canonical primary scaling lever by damage class:
    // Physical baseline  = SkillBase * (1 + Body / 20)
    // Magical baseline   = SkillBase * (1 + Mind / 20)
    const primaryClassMultiplier = damageClass === 'magical'
        ? levers.mindMagicMultiplier
        : levers.bodyDamageMultiplier;
    const bodyScaledPower = intent.basePower * primaryClassMultiplier;

    // Optional per-skill scaling overlays.
    const scalingPower = intent.scaling.reduce((acc, term) => {
        const stat = intent.trinity[term.attribute] || 0;
        return acc + (stat * term.coefficient);
    }, 0);

    const statusMultiplier = computeStatusMultiplier(intent.statusMultipliers);
    const riskMultiplier = computeRiskMultiplier(intent);
    const criticalMultiplier = levers.instinctCriticalMultiplier;
    const hit = interactionModel === 'triangle'
        ? computeHitMultiplier(intent.trinity, intent.targetTrinity, damageClass)
        : { multiplier: 1, pressure: 0 };
    const mitigation = interactionModel === 'triangle'
        ? computeMitigationMultiplier(intent.targetTrinity, damageClass)
        : { multiplier: 1, pressure: 0 };
    const crit = interactionModel === 'triangle'
        ? computeCritExpectedMultiplier(intent.trinity, intent.targetTrinity, damageClass, criticalMultiplier)
        : { multiplier: criticalMultiplier, critPressure: 0, resistancePressure: 0 };

    const rawFinal = (bodyScaledPower + scalingPower)
        * statusMultiplier
        * riskMultiplier
        * hit.multiplier
        * mitigation.multiplier
        * crit.multiplier;
    const finalPower = Math.max(0, Math.floor(rawFinal));
    const rawContrib = computeTrinityContributions(intent, levers, bodyScaledPower, scalingPower, criticalMultiplier);
    const contribTotal = Math.max(1e-6, rawContrib.body + rawContrib.mind + rawContrib.instinct);
    const bodyContribution = round3(rawContrib.body / contribTotal);
    const mindContribution = round3(rawContrib.mind / contribTotal);
    const instinctContribution = round3(rawContrib.instinct / contribTotal);
    const theoreticalMax = Math.max(1, intent.theoreticalMaxPower ?? rawFinal);
    const efficiency = clamp(finalPower / theoreticalMax, 0, 1);

    return {
        basePower: intent.basePower,
        bodyScaledPower: round3(bodyScaledPower),
        scalingPower: round3(scalingPower),
        statusMultiplier: round3(statusMultiplier),
        riskMultiplier: round3(riskMultiplier),
        criticalMultiplier: round3(criticalMultiplier),
        hitMultiplier: round3(hit.multiplier),
        mitigationMultiplier: round3(mitigation.multiplier),
        critExpectedMultiplier: round3(crit.multiplier),
        finalPower,
        bodyContribution,
        mindContribution,
        instinctContribution,
        scoreEvent: {
            skillId: intent.skillId,
            attackerId: intent.attackerId,
            targetId: intent.targetId,
            efficiency: round3(efficiency),
            riskBonusApplied: !!intent.inDangerPreviewHex,
            damageClass,
            hitPressure: hit.pressure,
            mitigationPressure: mitigation.pressure,
            critPressure: crit.critPressure,
            resistancePressure: crit.resistancePressure,
            bodyContribution,
            mindContribution,
            instinctContribution
        }
    };
};

export class GrandCalculator {
    static resolveCombat(intent: CombatIntent): CombatCalculationResult {
        return calculateCombat(intent);
    }

    static resolveStatusDuration(baseDuration: number, trinity: TrinityStats): number {
        return computeStatusDuration(baseDuration, trinity);
    }

    static resolveInitiativeBonus(trinity: TrinityStats): number {
        return computeInitiativeBonus(trinity);
    }

    static resolveCriticalMultiplier(trinity: TrinityStats): number {
        return computeCriticalMultiplier(trinity);
    }

    static resolveSparkCost(moveIndex: number, trinity: TrinityStats): number {
        return computeSparkCost(moveIndex, trinity);
    }
}

export const extractTrinityStats = (actor: Actor): TrinityStats => {
    const trinity = getComponent<TrinityComponent>(actor.components, 'trinity');
    if (trinity) {
        return {
            body: trinity.body,
            mind: trinity.mind,
            instinct: trinity.instinct
        };
    }
    const stats = getComponent<StatsComponent>(actor.components, 'stats');
    const body = stats?.strength ?? 0;
    const mind = stats?.defense ?? 0;
    const instinct = stats?.evasion ?? 0;
    return { body, mind, instinct };
};
