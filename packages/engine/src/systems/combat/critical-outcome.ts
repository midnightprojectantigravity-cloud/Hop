import type { HitQualityTier } from './hit-quality';

export interface CriticalOutcomeInput {
    hitQualityTier: HitQualityTier;
    attackerInstinct: number;
    defenderBody: number;
    canMultiCrit?: boolean;
    critTierCap?: number;
    baseCritSeverity?: number;
}

export interface CriticalOutcomeResult {
    critChance: number;
    critSeverity: number;
    critTiersApplied: number;
    damageMultiplier: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const calculateCriticalOutcome = (input: CriticalOutcomeInput): CriticalOutcomeResult => {
    const baseCritSeverity = Number.isFinite(input.baseCritSeverity) ? Number(input.baseCritSeverity) : 2.5;
    const bodyResilience = clamp(Math.max(0, Number(input.defenderBody || 0)) * 0.05, 0, 1.5);
    const critSeverity = Math.max(1.1, baseCritSeverity - bodyResilience);
    const instinct = Math.max(1, Number(input.attackerInstinct || 1));
    const critChance = clamp((Math.log(instinct) / 5), 0, 1);

    if (input.hitQualityTier !== 'critical' && input.hitQualityTier !== 'multi_critical') {
        return {
            critChance,
            critSeverity,
            critTiersApplied: 0,
            damageMultiplier: 1
        };
    }

    const tierCap = Math.max(1, Math.floor(Number(input.critTierCap ?? 1)));
    const critTiersApplied = input.hitQualityTier === 'multi_critical' && input.canMultiCrit
        ? tierCap
        : 1;
    return {
        critChance,
        critSeverity,
        critTiersApplied,
        damageMultiplier: critSeverity + Math.max(0, critTiersApplied - 1)
    };
};
