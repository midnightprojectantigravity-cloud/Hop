export type TrackingSignature = 'melee' | 'projectile' | 'magic';
export type HitQualityTier = 'glancing' | 'normal' | 'critical' | 'multi_critical' | 'miss';

export interface HitQualityInput {
    attackerInstinct: number;
    attackerMind?: number;
    defenderInstinct: number;
    trackingSignature: TrackingSignature;
    distance?: number;
    hqFloor?: number;
    meleeAttackerInstinctCoefficient?: number;
    meleeDefenderInstinctCoefficient?: number;
    meleeAdjacencyCoefficient?: number;
    projectileAttackerInstinctCoefficient?: number;
    projectileDefenderInstinctCoefficient?: number;
    projectileRangeCoefficient?: number;
    spellAttackerMindCoefficient?: number;
    spellDefenderInstinctCoefficient?: number;
    spellDistanceDodgeCoefficient?: number;
    canMultiCrit?: boolean;
}

export interface HitQualityResult {
    rawRatio: number;
    effectiveRatio: number;
    tier: HitQualityTier;
    scalar: number;
    pressureAtt: number;
    pressureDef: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const clampInstinct = (value: number): number => Math.max(1, Number.isFinite(value) ? value : 1);
const clampStat = (value: number): number => Math.max(0, Number.isFinite(value) ? value : 0);

export const calculateHitQuality = (input: HitQualityInput): HitQualityResult => {
    const attackerInstinct = clampInstinct(input.attackerInstinct);
    const attackerMind = clampStat(input.attackerMind ?? 0);
    const defenderInstinct = clampInstinct(input.defenderInstinct);
    const distance = Math.max(0, Number.isFinite(input.distance) ? Number(input.distance) : 0);
    const hqFloor = Math.max(1e-6, Number.isFinite(input.hqFloor) ? Number(input.hqFloor) : 1);

    let pressureAtt = 1;
    let pressureDef = 1;
    let rawRatio = 1;

    if (input.trackingSignature === 'melee') {
        const attackerCoefficient = Number.isFinite(input.meleeAttackerInstinctCoefficient)
            ? Number(input.meleeAttackerInstinctCoefficient)
            : 1;
        const defenderCoefficient = Number.isFinite(input.meleeDefenderInstinctCoefficient)
            ? Number(input.meleeDefenderInstinctCoefficient)
            : 1;
        const adjacencyCoefficient = Number.isFinite(input.meleeAdjacencyCoefficient)
            ? Number(input.meleeAdjacencyCoefficient)
            : 1;
        pressureAtt = Math.max(hqFloor, (attackerInstinct * attackerCoefficient) + adjacencyCoefficient);
        pressureDef = Math.max(hqFloor, defenderInstinct * defenderCoefficient);
        rawRatio = pressureAtt / pressureDef;
    } else if (input.trackingSignature === 'projectile') {
        const attackerCoefficient = Number.isFinite(input.projectileAttackerInstinctCoefficient)
            ? Number(input.projectileAttackerInstinctCoefficient)
            : 1;
        const defenderCoefficient = Number.isFinite(input.projectileDefenderInstinctCoefficient)
            ? Number(input.projectileDefenderInstinctCoefficient)
            : 1;
        const rangeCoefficient = Number.isFinite(input.projectileRangeCoefficient)
            ? Number(input.projectileRangeCoefficient)
            : 0.08;
        pressureAtt = Math.max(hqFloor, (attackerInstinct * attackerCoefficient) + (distance * rangeCoefficient));
        pressureDef = Math.max(hqFloor, defenderInstinct * defenderCoefficient);
        rawRatio = pressureAtt / pressureDef;
    } else if (input.trackingSignature === 'magic') {
        const attackerCoefficient = Number.isFinite(input.spellAttackerMindCoefficient)
            ? Number(input.spellAttackerMindCoefficient)
            : 1;
        const defenderCoefficient = Number.isFinite(input.spellDefenderInstinctCoefficient)
            ? Number(input.spellDefenderInstinctCoefficient)
            : 1;
        const distanceCoefficient = Number.isFinite(input.spellDistanceDodgeCoefficient)
            ? Number(input.spellDistanceDodgeCoefficient)
            : 0.08;
        pressureAtt = Math.max(hqFloor, attackerMind * attackerCoefficient);
        pressureDef = Math.max(hqFloor, (defenderInstinct * defenderCoefficient) + (distance * distanceCoefficient));
        rawRatio = pressureAtt / pressureDef;
    }
    // Keep a real miss band below glancing so minimum-damage logic only applies
    // to landed hits, not total whiffs.
    const effectiveRatio = clamp(1 + Math.log(Math.max(rawRatio, Number.EPSILON)), 0, 2.5);

    if (effectiveRatio < 0.25) {
        return { rawRatio, effectiveRatio, tier: 'miss', scalar: 0, pressureAtt, pressureDef };
    }
    if (effectiveRatio < 0.75) {
        return { rawRatio, effectiveRatio, tier: 'glancing', scalar: 0.25, pressureAtt, pressureDef };
    }
    if (effectiveRatio < 1.25) {
        return { rawRatio, effectiveRatio, tier: 'normal', scalar: 1, pressureAtt, pressureDef };
    }
    if (effectiveRatio < 2) {
        return { rawRatio, effectiveRatio, tier: 'critical', scalar: 1, pressureAtt, pressureDef };
    }
    return {
        rawRatio,
        effectiveRatio,
        tier: input.canMultiCrit ? 'multi_critical' : 'critical',
        scalar: 1,
        pressureAtt,
        pressureDef
    };
};
