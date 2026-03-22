import type { CombatRulesetVersion } from '../../types';
import { TRINITY_RATIO_V2_HP_COEFFICIENTS } from './combat-coefficients';

export interface TrinityStats {
    body: number;
    mind: number;
    instinct: number;
}

export interface TrinityRuntimeLevers {
    bodyDamageMultiplier: number;
    bodyMitigation: number;
    mindStatusDurationBonus: number;
    mindMagicMultiplier: number;
    instinctInitiativeBonus: number;
    instinctCriticalMultiplier: number;
    instinctSparkDiscountMultiplier: number;
}

export interface TrinityWeightProfile {
    base: number;
    body: number;
    mind: number;
    instinct: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

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

export const resolveTrinityWeights = (_version: CombatRulesetVersion = 'trinity_ratio_v2'): TrinityWeightProfile => ({
    base: 0,
    body: TRINITY_RATIO_V2_HP_COEFFICIENTS.body,
    mind: TRINITY_RATIO_V2_HP_COEFFICIENTS.mind,
    instinct: TRINITY_RATIO_V2_HP_COEFFICIENTS.instinct
});

export const resolveTrinityLevers = (
    trinity: TrinityStats,
    _version: CombatRulesetVersion = 'trinity_ratio_v2'
): TrinityRuntimeLevers => {
    const body = Math.max(0, trinity.body);
    const mind = Math.max(0, trinity.mind);
    const instinct = Math.max(0, trinity.instinct);

    const instinctCriticalMultiplier = round3(1 + (clamp(instinct, 0, 10) * 0.015));

    return {
        bodyDamageMultiplier: round3(1 + (body / 20)),
        bodyMitigation: round3(clamp(body * 0.01, 0, 0.5)),
        mindStatusDurationBonus: Math.floor(mind / 15),
        mindMagicMultiplier: round3(1 + (mind / 20)),
        instinctInitiativeBonus: instinct * 2,
        instinctCriticalMultiplier,
        instinctSparkDiscountMultiplier: round3(1 - clamp(instinct, 0, 100) / 100)
    };
};

export const computeSparkCostFromTrinity = (
    moveIndex: number,
    trinity: TrinityStats,
    version: CombatRulesetVersion = 'trinity_ratio_v2'
): number => {
    const base = fibonacci(Math.max(0, moveIndex));
    const levers = resolveTrinityLevers(trinity, version);
    return round3(base * levers.instinctSparkDiscountMultiplier);
};

export const deriveMaxHpFromTrinity = (
    trinity: TrinityStats,
    version: CombatRulesetVersion = 'trinity_ratio_v2'
): number => {
    const body = Math.max(0, trinity.body);
    const mind = Math.max(0, trinity.mind);
    const instinct = Math.max(0, trinity.instinct);

    const cfg = resolveTrinityWeights(version);

    const hp = Math.floor(
        (body * cfg.body)
        + (mind * cfg.mind)
        + (instinct * cfg.instinct)
        + cfg.base
    );
    return Math.max(1, hp);
};
