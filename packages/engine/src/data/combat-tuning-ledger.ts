import type { RoundMode } from './contracts';
import type { TrinityStats } from '../systems/combat/trinity-resolver';

type CombatAttribute = 'body' | 'mind' | 'instinct';
export type CombatDamageClass = 'physical' | 'magical' | 'true';
export type CombatAttackProfile = 'melee' | 'projectile' | 'spell' | 'status';
export type CombatIntentTag =
    | 'damage'
    | 'move'
    | 'heal'
    | 'protect'
    | 'control'
    | 'summon'
    | 'hazard'
    | 'objective'
    | 'economy'
    | 'utility';
export type CombatTrackingSignature = 'melee' | 'projectile' | 'magic';

export type CombatNumberFormula =
    | { kind: 'constant'; value: number }
    | {
        kind: 'attribute_ratio';
        attribute: CombatAttribute;
        base: number;
        divisor: number;
        minimum?: number;
        round?: RoundMode;
    }
    | {
        kind: 'attribute_threshold';
        attribute: CombatAttribute;
        threshold: number;
        below: number;
        above: number;
    }
    | {
        kind: 'weighted_sum';
        base?: number;
        terms: Array<{ attribute: CombatAttribute; coefficient: number }>;
        minimum?: number;
        round?: RoundMode;
    };

export interface CombatSkillProfile {
    skillId: string;
    intentTags: CombatIntentTag[];
    threatRange: CombatNumberFormula;
    representativeDamage: CombatNumberFormula;
    requiresContact: boolean;
    damageClass?: CombatDamageClass;
    attackProfile?: CombatAttackProfile;
    trackingSignature?: CombatTrackingSignature;
}

export interface CombatTuningVariables {
    trinityHp: {
        base: number;
        body: number;
        mind: number;
        instinct: number;
    };
    trinityLevers: {
        basePowerMultiplier: number;
        bodyDamageMultiplierPerPoint: number;
        mindDamageMultiplierPerPoint: number;
        instinctDamageMultiplierPerPoint: number;
        bodyMitigationPerPoint: number;
        bodyMitigationCap: number;
        mindStatusDurationDivisor: number;
        mindMagicMultiplierPerPoint: number;
        instinctInitiativeBonusPerPoint: number;
        instinctCriticalMultiplierPerPoint: number;
        instinctCriticalMultiplierCap: number;
        instinctSparkDiscountPerPoint: number;
        instinctSparkDiscountCap: number;
    };
    hitQuality: {
        floor: number;
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
        missThreshold: number;
        glancingThreshold: number;
        normalThreshold: number;
        criticalThreshold: number;
    };
    critical: {
        baseSeverity: number;
        minSeverity: number;
        bodyResiliencePerPoint: number;
        critChanceLogDivisor: number;
    };
    status: {
        minProcChance: number;
        minPotencyScalar: number;
        minDuration: number;
    };
    initiative: {
        instinctCoefficient: number;
        mindCoefficient: number;
    };
    projection: {
        physicalDefenseBody: number;
        magicalDefenseMind: number;
    };
    enemyCombat: {
        bossTrinityTotalThreshold: number;
        highInstinctThreshold: number;
        boostedSpeed: number;
        baseSpeed: number;
        baseActionCooldown: number;
        hazardActionCooldown: number;
        bossActionCooldown: number;
    };
}

export const COMBAT_TUNING_VARIABLES: CombatTuningVariables = {
    trinityHp: {
        base: 0,
        body: 6,
        mind: 1,
        instinct: 3
    },
    trinityLevers: {
        basePowerMultiplier: 1,
        bodyDamageMultiplierPerPoint: 0.5,
        mindDamageMultiplierPerPoint: 0.5,
        instinctDamageMultiplierPerPoint: 0.5,
        bodyMitigationPerPoint: 0.01,
        bodyMitigationCap: 0.5,
        mindStatusDurationDivisor: 15,
        mindMagicMultiplierPerPoint: 0.05,
        instinctInitiativeBonusPerPoint: 2,
        instinctCriticalMultiplierPerPoint: 0.015,
        instinctCriticalMultiplierCap: 10,
        instinctSparkDiscountPerPoint: 0.01,
        instinctSparkDiscountCap: 100
    },
    hitQuality: {
        floor: 1,
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
        },
        missThreshold: 0.25,
        glancingThreshold: 0.75,
        normalThreshold: 1.25,
        criticalThreshold: 2
    },
    critical: {
        baseSeverity: 2.5,
        minSeverity: 1.1,
        bodyResiliencePerPoint: 0.05,
        critChanceLogDivisor: 5
    },
    status: {
        minProcChance: 0,
        minPotencyScalar: 0.25,
        minDuration: 1
    },
    initiative: {
        instinctCoefficient: 0.7,
        mindCoefficient: 0.3
    },
    projection: {
        physicalDefenseBody: 0.2,
        magicalDefenseMind: 0.5
    },
    enemyCombat: {
        bossTrinityTotalThreshold: 40,
        highInstinctThreshold: 12,
        boostedSpeed: 2,
        baseSpeed: 1,
        baseActionCooldown: 2,
        hazardActionCooldown: 3,
        bossActionCooldown: 1
    }
};

export const COMBAT_MOVEMENT_BURST_SKILL_IDS = new Set([
    'DASH',
    'GRAPPLE_HOOK',
    'JUMP',
    'VAULT',
    'WITHDRAWAL',
    'SWIFT_ROLL',
    'SHADOW_STEP',
    'PHASE_STEP',
    'SOUL_SWAP',
    'BULWARK_CHARGE'
]);

export const COMBAT_TELEGRAPH_SKILL_IDS = new Set([
    'SENTINEL_TELEGRAPH',
    'SENTINEL_BLAST'
]);

const DEFAULT_COMBAT_SKILL_PROFILE: CombatSkillProfile = {
    skillId: 'UNKNOWN',
    intentTags: [],
    threatRange: { kind: 'constant', value: 0 },
    representativeDamage: { kind: 'constant', value: 0 },
    requiresContact: true
};

export const COMBAT_SKILL_PROFILES: Record<string, CombatSkillProfile> = {
    BASIC_MOVE: {
        skillId: 'BASIC_MOVE',
        intentTags: ['move', 'objective', 'utility'],
        threatRange: { kind: 'constant', value: 1 },
        representativeDamage: { kind: 'constant', value: 0 },
        requiresContact: true
    },
    BASIC_ATTACK: {
        skillId: 'BASIC_ATTACK',
        intentTags: ['damage'],
        threatRange: { kind: 'constant', value: 1 },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'body',
            base: 1,
            divisor: 12,
            minimum: 1,
            round: 'round'
        },
        requiresContact: true,
        damageClass: 'physical',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    AUTO_ATTACK: {
        skillId: 'AUTO_ATTACK',
        intentTags: ['damage', 'utility'],
        threatRange: { kind: 'constant', value: 1 },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'body',
            base: 1,
            divisor: 16,
            minimum: 1,
            round: 'round'
        },
        requiresContact: true,
        damageClass: 'physical',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    DASH: {
        skillId: 'DASH',
        intentTags: ['move', 'damage', 'utility'],
        threatRange: { kind: 'constant', value: 2 },
        representativeDamage: {
            kind: 'attribute_threshold',
            attribute: 'instinct',
            threshold: 12,
            below: 2,
            above: 3
        },
        requiresContact: true,
        damageClass: 'physical',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    GRAPPLE_HOOK: {
        skillId: 'GRAPPLE_HOOK',
        intentTags: ['move', 'control', 'damage', 'utility'],
        threatRange: { kind: 'constant', value: 2 },
        representativeDamage: {
            kind: 'attribute_threshold',
            attribute: 'instinct',
            threshold: 12,
            below: 1,
            above: 2
        },
        requiresContact: true,
        damageClass: 'physical',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    SHIELD_BASH: {
        skillId: 'SHIELD_BASH',
        intentTags: ['damage', 'control', 'protect'],
        threatRange: { kind: 'constant', value: 1 },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'body',
            base: 1,
            divisor: 16,
            minimum: 1,
            round: 'round'
        },
        requiresContact: true,
        damageClass: 'physical',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    ARCHER_SHOT: {
        skillId: 'ARCHER_SHOT',
        intentTags: ['damage'],
        threatRange: { kind: 'constant', value: 4 },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'instinct',
            base: 1,
            divisor: 7,
            minimum: 1,
            round: 'round'
        },
        requiresContact: false,
        damageClass: 'physical',
        attackProfile: 'projectile',
        trackingSignature: 'projectile'
    },
    BOMB_TOSS: {
        skillId: 'BOMB_TOSS',
        intentTags: ['damage', 'control', 'hazard'],
        threatRange: { kind: 'constant', value: 3 },
        representativeDamage: { kind: 'constant', value: 1 },
        requiresContact: false,
        damageClass: 'physical',
        attackProfile: 'projectile',
        trackingSignature: 'projectile'
    },
    TIME_BOMB: {
        skillId: 'TIME_BOMB',
        intentTags: ['damage', 'control', 'hazard'],
        threatRange: { kind: 'constant', value: 3 },
        representativeDamage: { kind: 'constant', value: 1 },
        requiresContact: false,
        damageClass: 'physical',
        attackProfile: 'projectile',
        trackingSignature: 'projectile'
    },
    FIREBALL: {
        skillId: 'FIREBALL',
        intentTags: ['damage', 'hazard'],
        threatRange: { kind: 'constant', value: 4 },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'mind',
            base: 1,
            divisor: 1,
            minimum: 1,
            round: 'round'
        },
        requiresContact: false,
        damageClass: 'magical',
        attackProfile: 'spell',
        trackingSignature: 'magic'
    },
    SENTINEL_TELEGRAPH: {
        skillId: 'SENTINEL_TELEGRAPH',
        intentTags: ['control', 'objective'],
        threatRange: { kind: 'constant', value: 4 },
        representativeDamage: { kind: 'constant', value: 0 },
        requiresContact: false
    },
    SENTINEL_BLAST: {
        skillId: 'SENTINEL_BLAST',
        intentTags: ['damage', 'hazard'],
        threatRange: { kind: 'constant', value: 4 },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'mind',
            base: 2,
            divisor: 7,
            minimum: 2,
            round: 'round'
        },
        requiresContact: false,
        damageClass: 'magical',
        attackProfile: 'spell',
        trackingSignature: 'magic'
    }
};

const applyRoundMode = (value: number, round: RoundMode | undefined): number => {
    if (round === 'floor') return Math.floor(value);
    if (round === 'round') return Math.round(value);
    if (round === 'ceil') return Math.ceil(value);
    return value;
};

export const resolveCombatTuning = (_skillId?: string): CombatTuningVariables => (
    COMBAT_TUNING_VARIABLES
);

export const evaluateCombatNumericFormula = (
    formula: CombatNumberFormula,
    trinity: TrinityStats
): number => {
    if (formula.kind === 'constant') {
        return formula.value;
    }
    if (formula.kind === 'attribute_ratio') {
        const source = Math.max(0, Number(trinity[formula.attribute] || 0));
        const raw = Number(formula.base || 0) + Math.round(source / Math.max(1e-9, Number(formula.divisor || 1)));
        const rounded = applyRoundMode(raw, formula.round);
        return Math.max(formula.minimum ?? 0, rounded);
    }
    if (formula.kind === 'attribute_threshold') {
        const source = Math.max(0, Number(trinity[formula.attribute] || 0));
        return source >= formula.threshold ? formula.above : formula.below;
    }
    const raw = formula.terms.reduce(
        (sum, term) => sum + (Math.max(0, Number(trinity[term.attribute] || 0)) * term.coefficient),
        Number(formula.base || 0)
    );
    const rounded = applyRoundMode(raw, formula.round);
    return Math.max(formula.minimum ?? 0, rounded);
};

export const resolveCombatSkillProfile = (skillId: string): CombatSkillProfile => (
    COMBAT_SKILL_PROFILES[skillId] || {
        ...DEFAULT_COMBAT_SKILL_PROFILE,
        skillId
    }
);
