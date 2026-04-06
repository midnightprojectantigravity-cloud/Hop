import type { CombatRulesetVersion } from '../../types';
import { COMBAT_TUNING_VARIABLES, resolveCombatTuning } from '../../data/combat-tuning-ledger';

export interface TrinityStats {
    body: number;
    mind: number;
    instinct: number;
}

export interface TrinityRuntimeLevers {
    basePowerMultiplier: number;
    bodyDamageMultiplier: number;
    mindDamageMultiplier: number;
    instinctDamageMultiplier: number;
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
    body: COMBAT_TUNING_VARIABLES.trinityHp.body,
    mind: COMBAT_TUNING_VARIABLES.trinityHp.mind,
    instinct: COMBAT_TUNING_VARIABLES.trinityHp.instinct
});

export const resolveTrinityLevers = (
    trinity: TrinityStats,
    _version: CombatRulesetVersion = 'trinity_ratio_v2',
    skillId?: string
): TrinityRuntimeLevers => {
    const body = Math.max(0, trinity.body);
    const mind = Math.max(0, trinity.mind);
    const instinct = Math.max(0, trinity.instinct);
    const tuning = resolveCombatTuning(skillId);

    const instinctCriticalMultiplier = round3(1 + (clamp(instinct, 0, COMBAT_TUNING_VARIABLES.trinityLevers.instinctCriticalMultiplierCap) * COMBAT_TUNING_VARIABLES.trinityLevers.instinctCriticalMultiplierPerPoint));

    return {
        basePowerMultiplier: round3(tuning.trinityLevers.basePowerMultiplier),
        bodyDamageMultiplier: round3(tuning.trinityLevers.bodyDamageMultiplierPerPoint),
        mindDamageMultiplier: round3(tuning.trinityLevers.mindDamageMultiplierPerPoint),
        instinctDamageMultiplier: round3(tuning.trinityLevers.instinctDamageMultiplierPerPoint),
        bodyMitigation: round3(clamp(body * COMBAT_TUNING_VARIABLES.trinityLevers.bodyMitigationPerPoint, 0, COMBAT_TUNING_VARIABLES.trinityLevers.bodyMitigationCap)),
        mindStatusDurationBonus: Math.floor(mind / COMBAT_TUNING_VARIABLES.trinityLevers.mindStatusDurationDivisor),
        mindMagicMultiplier: round3(1 + (mind * COMBAT_TUNING_VARIABLES.trinityLevers.mindMagicMultiplierPerPoint)),
        instinctInitiativeBonus: instinct * COMBAT_TUNING_VARIABLES.trinityLevers.instinctInitiativeBonusPerPoint,
        instinctCriticalMultiplier,
        instinctSparkDiscountMultiplier: round3(1 - clamp(instinct, 0, COMBAT_TUNING_VARIABLES.trinityLevers.instinctSparkDiscountCap) * COMBAT_TUNING_VARIABLES.trinityLevers.instinctSparkDiscountPerPoint)
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
