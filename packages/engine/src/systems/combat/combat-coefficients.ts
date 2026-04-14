import type { CombatAttribute } from './combat-calculator';
import type { TrackingSignature } from './hit-quality';
import { resolveCombatTuning } from '../../data/combat-tuning-ledger';

const COMBAT_TUNING = resolveCombatTuning();

export interface ProjectionCoefficientSet {
    body: number;
    instinct: number;
    mind: number;
}

export interface HitQualityCoefficientSet {
    hqFloor: number;
    melee: {
        attackerInstinct: number;
        defenderInstinct: number;
        adjacency: number;
    };
    projectile: {
        attackerInstinct: number;
        defenderInstinct: number;
        range: number;
    };
    spell: {
        attackerMind: number;
        defenderInstinct: number;
        distanceDodge: number;
    };
}

export const TRINITY_RATIO_V2_HP_COEFFICIENTS = {
    body: COMBAT_TUNING.trinityHp.body,
    instinct: COMBAT_TUNING.trinityHp.instinct,
    mind: COMBAT_TUNING.trinityHp.mind
} as const;

export const TRINITY_RATIO_V2_DEFENSE_DEFAULTS = {
    physical: {
        body: COMBAT_TUNING.projection.physicalDefenseBody,
        instinct: 0,
        mind: 0
    },
    magical: {
        body: 0,
        instinct: 0,
        mind: COMBAT_TUNING.projection.magicalDefenseMind
    }
} as const;

export const TRINITY_RATIO_V2_HQ_COEFFICIENTS: HitQualityCoefficientSet = {
    hqFloor: COMBAT_TUNING.hitQuality.floor,
    melee: {
        attackerInstinct: COMBAT_TUNING.hitQuality.melee.attackerInstinct,
        defenderInstinct: COMBAT_TUNING.hitQuality.melee.defenderInstinct,
        adjacency: COMBAT_TUNING.hitQuality.melee.adjacency
    },
    projectile: {
        attackerInstinct: COMBAT_TUNING.hitQuality.projectile.attackerInstinct,
        defenderInstinct: COMBAT_TUNING.hitQuality.projectile.defenderInstinct,
        range: COMBAT_TUNING.hitQuality.projectile.range
    },
    spell: {
        attackerMind: COMBAT_TUNING.hitQuality.spell.attackerMind,
        defenderInstinct: COMBAT_TUNING.hitQuality.spell.defenderInstinct,
        distanceDodge: COMBAT_TUNING.hitQuality.spell.distanceDodge
    }
};

export const COMBAT_COEFFICIENTS_VERSION = 'trinity_ratio_v2_ledger_v1';

const emptyProjection = (): ProjectionCoefficientSet => ({
    body: 0,
    instinct: 0,
    mind: 0
});

export const resolveProjectionFromScaling = (
    scaling: Array<{ attribute: CombatAttribute; coefficient: number }>
): ProjectionCoefficientSet => {
    const result = emptyProjection();
    for (const term of scaling) {
        result[term.attribute] += Number(term.coefficient || 0);
    }
    return result;
};

export const resolvePhysicalProjectionCoefficients = (
    scaling: Array<{ attribute: CombatAttribute; coefficient: number }>
): ProjectionCoefficientSet => {
    const fromScaling = resolveProjectionFromScaling(scaling);
    if (fromScaling.body === 0 && fromScaling.instinct === 0 && fromScaling.mind === 0) {
        return { body: 1, instinct: 0, mind: 0 };
    }
    return fromScaling;
};

export const resolveMagicalProjectionCoefficients = (
    scaling: Array<{ attribute: CombatAttribute; coefficient: number }>
): ProjectionCoefficientSet => {
    const fromScaling = resolveProjectionFromScaling(scaling);
    if (fromScaling.body === 0 && fromScaling.instinct === 0 && fromScaling.mind === 0) {
        return { body: 0, instinct: 0, mind: 1 };
    }
    return fromScaling;
};

export const resolveDefenseProjectionCoefficients = (
    damageClass: 'physical' | 'magical'
): ProjectionCoefficientSet => (
    damageClass === 'magical'
        ? { ...TRINITY_RATIO_V2_DEFENSE_DEFAULTS.magical }
        : { ...TRINITY_RATIO_V2_DEFENSE_DEFAULTS.physical }
);

export const resolveHitQualityCoefficients = (
    trackingSignature: TrackingSignature
) => {
    if (trackingSignature === 'projectile') {
        return {
            hqFloor: TRINITY_RATIO_V2_HQ_COEFFICIENTS.hqFloor,
            ...TRINITY_RATIO_V2_HQ_COEFFICIENTS.projectile
        };
    }
    if (trackingSignature === 'magic') {
        return {
            hqFloor: TRINITY_RATIO_V2_HQ_COEFFICIENTS.hqFloor,
            ...TRINITY_RATIO_V2_HQ_COEFFICIENTS.spell
        };
    }
    return {
        hqFloor: TRINITY_RATIO_V2_HQ_COEFFICIENTS.hqFloor,
        ...TRINITY_RATIO_V2_HQ_COEFFICIENTS.melee
    };
};
