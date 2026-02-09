import type { Actor } from '../types';
import type { StatusID } from '../types/registry';
import { getComponent } from './components';

export type CombatAttribute = 'body' | 'mind' | 'instinct';

export interface TrinityStats {
    body: number;
    mind: number;
    instinct: number;
}

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
}

export interface CombatCalculationResult {
    basePower: number;
    bodyScaledPower: number;
    scalingPower: number;
    statusMultiplier: number;
    riskMultiplier: number;
    criticalMultiplier: number;
    finalPower: number;
    scoreEvent: CombatScoreEvent;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

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

export const computeStatusDuration = (baseDuration: number, trinity: TrinityStats): number => {
    if (baseDuration <= 0) return baseDuration;
    const bonus = Math.floor(Math.max(0, trinity.mind) / 15);
    return baseDuration + bonus;
};

export const computeInitiativeBonus = (trinity: TrinityStats): number => {
    return Math.max(0, trinity.instinct) * 2;
};

export const computeCriticalMultiplier = (trinity: TrinityStats): number => {
    const instinct = clamp(trinity.instinct, 0, 10);
    return 1 + (instinct * 0.02);
};

const fibonacci = (index: number): number => {
    if (index <= 0) return 0;
    if (index === 1) return 1;
    let a = 0;
    let b = 1;
    for (let i = 2; i <= index; i++) {
        const n = a + b;
        a = b;
        b = n;
    }
    return b;
};

export const computeSparkCost = (moveIndex: number, trinity: TrinityStats): number => {
    const base = fibonacci(Math.max(0, moveIndex));
    const discount = 1 - clamp(trinity.instinct, 0, 100) / 100;
    return round3(base * discount);
};

export const calculateCombat = (intent: CombatIntent): CombatCalculationResult => {
    // Canonical Body lever:
    // FinalDamage baseline = SkillBase * (1 + Body / 20)
    const bodyScaledPower = intent.basePower * (1 + (Math.max(0, intent.trinity.body) / 20));

    // Optional per-skill scaling overlays.
    const scalingPower = intent.scaling.reduce((acc, term) => {
        const stat = intent.trinity[term.attribute] || 0;
        return acc + (stat * term.coefficient);
    }, 0);

    const statusMultiplier = computeStatusMultiplier(intent.statusMultipliers);
    const riskMultiplier = computeRiskMultiplier(intent);
    const criticalMultiplier = computeCriticalMultiplier(intent.trinity);
    const rawFinal = (bodyScaledPower + scalingPower) * statusMultiplier * riskMultiplier * criticalMultiplier;
    const finalPower = Math.max(0, Math.floor(rawFinal));
    const theoreticalMax = Math.max(1, intent.theoreticalMaxPower ?? rawFinal);
    const efficiency = clamp(finalPower / theoreticalMax, 0, 1);

    return {
        basePower: intent.basePower,
        bodyScaledPower: round3(bodyScaledPower),
        scalingPower: round3(scalingPower),
        statusMultiplier: round3(statusMultiplier),
        riskMultiplier: round3(riskMultiplier),
        criticalMultiplier: round3(criticalMultiplier),
        finalPower,
        scoreEvent: {
            skillId: intent.skillId,
            attackerId: intent.attackerId,
            targetId: intent.targetId,
            efficiency: round3(efficiency),
            riskBonusApplied: !!intent.inDangerPreviewHex
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
    const trinity = getComponent(actor.components, 'trinity');
    if (trinity) {
        return {
            body: trinity.body,
            mind: trinity.mind,
            instinct: trinity.instinct
        };
    }
    const stats = getComponent(actor.components, 'stats');
    const body = stats?.strength ?? 0;
    const mind = stats?.defense ?? 0;
    const instinct = stats?.evasion ?? 0;
    return { body, mind, instinct };
};
