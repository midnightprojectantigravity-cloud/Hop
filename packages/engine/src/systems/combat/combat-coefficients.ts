import type { CombatAttribute } from './combat-calculator';
import type { TrackingSignature } from './hit-quality';

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
    body: 6,
    instinct: 3,
    mind: 1
} as const;

export const TRINITY_RATIO_V2_DEFENSE_DEFAULTS = {
    physical: {
        body: 0.2,
        instinct: 0,
        mind: 0
    },
    magical: {
        body: 0,
        instinct: 0,
        mind: 0.5
    }
} as const;

export const TRINITY_RATIO_V2_HQ_COEFFICIENTS: HitQualityCoefficientSet = {
    hqFloor: 1,
    melee: {
        attackerInstinct: 1,
        defenderInstinct: 1,
        adjacency: 40
    },
    projectile: {
        attackerInstinct: 1,
        defenderInstinct: 1,
        range: 0.08
    },
    spell: {
        attackerMind: 1,
        defenderInstinct: 1,
        distanceDodge: 4
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
