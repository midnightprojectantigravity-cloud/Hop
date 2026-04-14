import type { RoundMode } from './contracts';
import type { TrinityStats } from '../systems/combat/trinity-resolver';
import { SCALED_IDENTITY } from '../constants';
import { validateFixedPointInteger } from './contract-parser';
import { fromFixedPoint, toFixedPoint, type FixedPointIssue } from './fixed-point';
import type {
    CombatAttackProfile,
    CombatDamageClass,
    CombatDamageElement,
    CombatDamageSubClass
} from '../systems/combat/damage-taxonomy';

type CombatAttribute = 'body' | 'mind' | 'instinct';

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
    | { kind: 'constant'; scaledValue: number }
    | {
        kind: 'attribute_ratio';
        attribute: CombatAttribute;
        scaledBase: number;
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
        scaledBase?: number;
        terms: Array<{ attribute: CombatAttribute; scaledCoefficient: number }>;
        minimum?: number;
        round?: RoundMode;
    };

export interface CombatSkillProfile {
    skillId: string;
    intentTags: CombatIntentTag[];
    threatRange: CombatNumberFormula;
    representativeDamage: CombatNumberFormula;
    requiresContact: boolean;
    damageClass: CombatDamageClass;
    damageSubClass: CombatDamageSubClass;
    damageElement: CombatDamageElement;
    attackProfile: CombatAttackProfile;
    trackingSignature: CombatTrackingSignature;
}

export interface CombatTuningVariables {
    coefficientScale: number;
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

export interface CombatTuningRuntimeVariables extends CombatTuningVariables {
    coefficientScale: number;
}

const scale = (value: number): number => toFixedPoint(value);
const unscale = (value: number): number => fromFixedPoint(value);

export const COMBAT_TUNING_VARIABLES: CombatTuningVariables = {
    coefficientScale: SCALED_IDENTITY,
    trinityHp: {
        base: scale(0),
        body: scale(6),
        mind: scale(1),
        instinct: scale(3)
    },
    trinityLevers: {
        basePowerMultiplier: scale(1),
        bodyDamageMultiplierPerPoint: scale(0.5),
        mindDamageMultiplierPerPoint: scale(0.5),
        instinctDamageMultiplierPerPoint: scale(0.5),
        bodyMitigationPerPoint: scale(0.01),
        bodyMitigationCap: scale(0.5),
        mindStatusDurationDivisor: 15,
        mindMagicMultiplierPerPoint: scale(0.05),
        instinctInitiativeBonusPerPoint: scale(2),
        instinctCriticalMultiplierPerPoint: scale(0.015),
        instinctCriticalMultiplierCap: 10,
        instinctSparkDiscountPerPoint: scale(0.01),
        instinctSparkDiscountCap: 100
    },
    hitQuality: {
        floor: scale(1),
        melee: {
            attackerInstinct: scale(1),
            defenderInstinct: scale(1),
            adjacency: scale(40)
        },
        projectile: {
            attackerInstinct: scale(1),
            defenderInstinct: scale(1),
            range: scale(0.08)
        },
        spell: {
            attackerMind: scale(1),
            defenderInstinct: scale(1),
            distanceDodge: scale(4)
        },
        missThreshold: 0.25,
        glancingThreshold: 0.75,
        normalThreshold: 1.25,
        criticalThreshold: 2
    },
    critical: {
        baseSeverity: scale(2.5),
        minSeverity: scale(1.1),
        bodyResiliencePerPoint: scale(0.05),
        critChanceLogDivisor: scale(5)
    },
    status: {
        minProcChance: scale(0),
        minPotencyScalar: scale(0.25),
        minDuration: 1
    },
    initiative: {
        instinctCoefficient: scale(0.7),
        mindCoefficient: scale(0.3)
    },
    projection: {
        physicalDefenseBody: scale(0.2),
        magicalDefenseMind: scale(0.5)
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
    threatRange: { kind: 'constant', scaledValue: scale(0) },
    representativeDamage: { kind: 'constant', scaledValue: scale(0) },
    requiresContact: true,
    damageClass: 'physical',
    damageSubClass: 'melee',
    damageElement: 'neutral',
    attackProfile: 'melee',
    trackingSignature: 'melee'
};

export const COMBAT_SKILL_PROFILES: Record<string, CombatSkillProfile> = {
    BASIC_MOVE: {
        skillId: 'BASIC_MOVE',
        intentTags: ['move', 'objective', 'utility'],
        threatRange: { kind: 'constant', scaledValue: scale(1) },
        representativeDamage: { kind: 'constant', scaledValue: scale(0) },
        requiresContact: true,
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    BASIC_ATTACK: {
        skillId: 'BASIC_ATTACK',
        intentTags: ['damage'],
        threatRange: { kind: 'constant', scaledValue: scale(1) },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'body',
            scaledBase: scale(1),
            divisor: 12,
            minimum: 1,
            round: 'round'
        },
        requiresContact: true,
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    AUTO_ATTACK: {
        skillId: 'AUTO_ATTACK',
        intentTags: ['damage', 'utility'],
        threatRange: { kind: 'constant', scaledValue: scale(1) },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'body',
            scaledBase: scale(1),
            divisor: 16,
            minimum: 1,
            round: 'round'
        },
        requiresContact: true,
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    DASH: {
        skillId: 'DASH',
        intentTags: ['move', 'damage', 'utility'],
        threatRange: { kind: 'constant', scaledValue: scale(2) },
        representativeDamage: {
            kind: 'attribute_threshold',
            attribute: 'instinct',
            threshold: 12,
            below: 2,
            above: 3
        },
        requiresContact: true,
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    GRAPPLE_HOOK: {
        skillId: 'GRAPPLE_HOOK',
        intentTags: ['move', 'control', 'damage', 'utility'],
        threatRange: { kind: 'constant', scaledValue: scale(2) },
        representativeDamage: {
            kind: 'attribute_threshold',
            attribute: 'instinct',
            threshold: 12,
            below: 1,
            above: 2
        },
        requiresContact: true,
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    SHIELD_BASH: {
        skillId: 'SHIELD_BASH',
        intentTags: ['damage', 'control', 'protect'],
        threatRange: { kind: 'constant', scaledValue: scale(1) },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'body',
            scaledBase: scale(1),
            divisor: 16,
            minimum: 1,
            round: 'round'
        },
        requiresContact: true,
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee'
    },
    ARCHER_SHOT: {
        skillId: 'ARCHER_SHOT',
        intentTags: ['damage'],
        threatRange: { kind: 'constant', scaledValue: scale(4) },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'instinct',
            scaledBase: scale(1),
            divisor: 7,
            minimum: 1,
            round: 'round'
        },
        requiresContact: false,
        damageClass: 'physical',
        damageSubClass: 'shot',
        damageElement: 'neutral',
        attackProfile: 'projectile',
        trackingSignature: 'projectile'
    },
    BOMB_TOSS: {
        skillId: 'BOMB_TOSS',
        intentTags: ['damage', 'control', 'hazard'],
        threatRange: { kind: 'constant', scaledValue: scale(3) },
        representativeDamage: { kind: 'constant', scaledValue: scale(1) },
        requiresContact: false,
        damageClass: 'physical',
        damageSubClass: 'shot',
        damageElement: 'neutral',
        attackProfile: 'projectile',
        trackingSignature: 'projectile'
    },
    TIME_BOMB: {
        skillId: 'TIME_BOMB',
        intentTags: ['damage', 'control', 'hazard'],
        threatRange: { kind: 'constant', scaledValue: scale(3) },
        representativeDamage: { kind: 'constant', scaledValue: scale(1) },
        requiresContact: false,
        damageClass: 'physical',
        damageSubClass: 'shot',
        damageElement: 'neutral',
        attackProfile: 'projectile',
        trackingSignature: 'projectile'
    },
    FIREBALL: {
        skillId: 'FIREBALL',
        intentTags: ['damage', 'hazard'],
        threatRange: { kind: 'constant', scaledValue: scale(4) },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'mind',
            scaledBase: scale(1),
            divisor: 1,
            minimum: 1,
            round: 'round'
        },
        requiresContact: false,
        damageClass: 'magical',
        damageSubClass: 'blast',
        damageElement: 'fire',
        attackProfile: 'spell',
        trackingSignature: 'magic'
    },
    SENTINEL_TELEGRAPH: {
        skillId: 'SENTINEL_TELEGRAPH',
        intentTags: ['control', 'objective'],
        threatRange: { kind: 'constant', scaledValue: scale(4) },
        representativeDamage: { kind: 'constant', scaledValue: scale(0) },
        requiresContact: false,
        damageClass: 'physical',
        damageSubClass: 'status',
        damageElement: 'neutral',
        attackProfile: 'status',
        trackingSignature: 'magic'
    },
    SENTINEL_BLAST: {
        skillId: 'SENTINEL_BLAST',
        intentTags: ['damage', 'hazard'],
        threatRange: { kind: 'constant', scaledValue: scale(4) },
        representativeDamage: {
            kind: 'attribute_ratio',
            attribute: 'mind',
            scaledBase: scale(2),
            divisor: 7,
            minimum: 2,
            round: 'round'
        },
        requiresContact: false,
        damageClass: 'magical',
        damageSubClass: 'blast',
        damageElement: 'fire',
        attackProfile: 'spell',
        trackingSignature: 'magic'
    }
};

export interface CombatTuningLedgerValidationResult {
    valid: boolean;
    issues: FixedPointIssue[];
}

const applyRoundMode = (value: number, round: RoundMode | undefined): number => {
    if (round === 'floor') return Math.floor(value);
    if (round === 'round') return Math.round(value);
    if (round === 'ceil') return Math.ceil(value);
    return value;
};

export const materializeCombatTuning = (
    tuning: CombatTuningVariables = COMBAT_TUNING_VARIABLES
): CombatTuningRuntimeVariables => ({
    coefficientScale: tuning.coefficientScale,
    trinityHp: {
        base: unscale(tuning.trinityHp.base),
        body: unscale(tuning.trinityHp.body),
        mind: unscale(tuning.trinityHp.mind),
        instinct: unscale(tuning.trinityHp.instinct)
    },
    trinityLevers: {
        basePowerMultiplier: unscale(tuning.trinityLevers.basePowerMultiplier),
        bodyDamageMultiplierPerPoint: unscale(tuning.trinityLevers.bodyDamageMultiplierPerPoint),
        mindDamageMultiplierPerPoint: unscale(tuning.trinityLevers.mindDamageMultiplierPerPoint),
        instinctDamageMultiplierPerPoint: unscale(tuning.trinityLevers.instinctDamageMultiplierPerPoint),
        bodyMitigationPerPoint: unscale(tuning.trinityLevers.bodyMitigationPerPoint),
        bodyMitigationCap: unscale(tuning.trinityLevers.bodyMitigationCap),
        mindStatusDurationDivisor: tuning.trinityLevers.mindStatusDurationDivisor,
        mindMagicMultiplierPerPoint: unscale(tuning.trinityLevers.mindMagicMultiplierPerPoint),
        instinctInitiativeBonusPerPoint: unscale(tuning.trinityLevers.instinctInitiativeBonusPerPoint),
        instinctCriticalMultiplierPerPoint: unscale(tuning.trinityLevers.instinctCriticalMultiplierPerPoint),
        instinctCriticalMultiplierCap: tuning.trinityLevers.instinctCriticalMultiplierCap,
        instinctSparkDiscountPerPoint: unscale(tuning.trinityLevers.instinctSparkDiscountPerPoint),
        instinctSparkDiscountCap: tuning.trinityLevers.instinctSparkDiscountCap
    },
    hitQuality: {
        floor: unscale(tuning.hitQuality.floor),
        melee: {
            attackerInstinct: unscale(tuning.hitQuality.melee.attackerInstinct),
            defenderInstinct: unscale(tuning.hitQuality.melee.defenderInstinct),
            adjacency: unscale(tuning.hitQuality.melee.adjacency)
        },
        projectile: {
            attackerInstinct: unscale(tuning.hitQuality.projectile.attackerInstinct),
            defenderInstinct: unscale(tuning.hitQuality.projectile.defenderInstinct),
            range: unscale(tuning.hitQuality.projectile.range)
        },
        spell: {
            attackerMind: unscale(tuning.hitQuality.spell.attackerMind),
            defenderInstinct: unscale(tuning.hitQuality.spell.defenderInstinct),
            distanceDodge: unscale(tuning.hitQuality.spell.distanceDodge)
        },
        missThreshold: tuning.hitQuality.missThreshold,
        glancingThreshold: tuning.hitQuality.glancingThreshold,
        normalThreshold: tuning.hitQuality.normalThreshold,
        criticalThreshold: tuning.hitQuality.criticalThreshold
    },
    critical: {
        baseSeverity: unscale(tuning.critical.baseSeverity),
        minSeverity: unscale(tuning.critical.minSeverity),
        bodyResiliencePerPoint: unscale(tuning.critical.bodyResiliencePerPoint),
        critChanceLogDivisor: unscale(tuning.critical.critChanceLogDivisor)
    },
    status: {
        minProcChance: unscale(tuning.status.minProcChance),
        minPotencyScalar: unscale(tuning.status.minPotencyScalar),
        minDuration: tuning.status.minDuration
    },
    initiative: {
        instinctCoefficient: unscale(tuning.initiative.instinctCoefficient),
        mindCoefficient: unscale(tuning.initiative.mindCoefficient)
    },
    projection: {
        physicalDefenseBody: unscale(tuning.projection.physicalDefenseBody),
        magicalDefenseMind: unscale(tuning.projection.magicalDefenseMind)
    },
    enemyCombat: { ...tuning.enemyCombat }
});

export const resolveCombatTuning = (_skillId?: string): CombatTuningRuntimeVariables =>
    materializeCombatTuning(COMBAT_TUNING_VARIABLES);

export const validateCombatTuningLedger = (
    ledger: CombatTuningVariables = COMBAT_TUNING_VARIABLES
): CombatTuningLedgerValidationResult => {
    const issues: FixedPointIssue[] = [];
    const check = (value: unknown, path: string) => validateFixedPointInteger(value, issues, path);

    if (ledger.coefficientScale !== SCALED_IDENTITY) {
        issues.push({ path: '$.coefficientScale', message: `Expected coefficientScale=${SCALED_IDENTITY}` });
    }

    check(ledger.trinityHp.base, '$.trinityHp.base');
    check(ledger.trinityHp.body, '$.trinityHp.body');
    check(ledger.trinityHp.mind, '$.trinityHp.mind');
    check(ledger.trinityHp.instinct, '$.trinityHp.instinct');

    const leverPaths: Array<[unknown, string]> = [
        [ledger.trinityLevers.basePowerMultiplier, '$.trinityLevers.basePowerMultiplier'],
        [ledger.trinityLevers.bodyDamageMultiplierPerPoint, '$.trinityLevers.bodyDamageMultiplierPerPoint'],
        [ledger.trinityLevers.mindDamageMultiplierPerPoint, '$.trinityLevers.mindDamageMultiplierPerPoint'],
        [ledger.trinityLevers.instinctDamageMultiplierPerPoint, '$.trinityLevers.instinctDamageMultiplierPerPoint'],
        [ledger.trinityLevers.bodyMitigationPerPoint, '$.trinityLevers.bodyMitigationPerPoint'],
        [ledger.trinityLevers.bodyMitigationCap, '$.trinityLevers.bodyMitigationCap'],
        [ledger.trinityLevers.mindMagicMultiplierPerPoint, '$.trinityLevers.mindMagicMultiplierPerPoint'],
        [ledger.trinityLevers.instinctInitiativeBonusPerPoint, '$.trinityLevers.instinctInitiativeBonusPerPoint'],
        [ledger.trinityLevers.instinctCriticalMultiplierPerPoint, '$.trinityLevers.instinctCriticalMultiplierPerPoint'],
        [ledger.trinityLevers.instinctCriticalMultiplierCap, '$.trinityLevers.instinctCriticalMultiplierCap'],
        [ledger.trinityLevers.instinctSparkDiscountPerPoint, '$.trinityLevers.instinctSparkDiscountPerPoint'],
        [ledger.trinityLevers.instinctSparkDiscountCap, '$.trinityLevers.instinctSparkDiscountCap'],
        [ledger.trinityLevers.mindStatusDurationDivisor, '$.trinityLevers.mindStatusDurationDivisor'],
        [ledger.critical.critChanceLogDivisor, '$.critical.critChanceLogDivisor'],
        [ledger.status.minDuration, '$.status.minDuration'],
        [ledger.enemyCombat.bossTrinityTotalThreshold, '$.enemyCombat.bossTrinityTotalThreshold'],
        [ledger.enemyCombat.highInstinctThreshold, '$.enemyCombat.highInstinctThreshold'],
        [ledger.enemyCombat.boostedSpeed, '$.enemyCombat.boostedSpeed'],
        [ledger.enemyCombat.baseSpeed, '$.enemyCombat.baseSpeed'],
        [ledger.enemyCombat.baseActionCooldown, '$.enemyCombat.baseActionCooldown'],
        [ledger.enemyCombat.hazardActionCooldown, '$.enemyCombat.hazardActionCooldown'],
        [ledger.enemyCombat.bossActionCooldown, '$.enemyCombat.bossActionCooldown']
    ];
    leverPaths.forEach(([value, path]) => check(value, path));

    check(ledger.hitQuality.floor, '$.hitQuality.floor');
    check(ledger.hitQuality.melee.attackerInstinct, '$.hitQuality.melee.attackerInstinct');
    check(ledger.hitQuality.melee.defenderInstinct, '$.hitQuality.melee.defenderInstinct');
    check(ledger.hitQuality.melee.adjacency, '$.hitQuality.melee.adjacency');
    check(ledger.hitQuality.projectile.attackerInstinct, '$.hitQuality.projectile.attackerInstinct');
    check(ledger.hitQuality.projectile.defenderInstinct, '$.hitQuality.projectile.defenderInstinct');
    check(ledger.hitQuality.projectile.range, '$.hitQuality.projectile.range');
    check(ledger.hitQuality.spell.attackerMind, '$.hitQuality.spell.attackerMind');
    check(ledger.hitQuality.spell.defenderInstinct, '$.hitQuality.spell.defenderInstinct');
    check(ledger.hitQuality.spell.distanceDodge, '$.hitQuality.spell.distanceDodge');

    check(ledger.critical.baseSeverity, '$.critical.baseSeverity');
    check(ledger.critical.minSeverity, '$.critical.minSeverity');
    check(ledger.critical.bodyResiliencePerPoint, '$.critical.bodyResiliencePerPoint');
    check(ledger.critical.critChanceLogDivisor, '$.critical.critChanceLogDivisor');

    check(ledger.status.minProcChance, '$.status.minProcChance');
    check(ledger.status.minPotencyScalar, '$.status.minPotencyScalar');
    check(ledger.status.minDuration, '$.status.minDuration');
    check(ledger.initiative.instinctCoefficient, '$.initiative.instinctCoefficient');
    check(ledger.initiative.mindCoefficient, '$.initiative.mindCoefficient');
    check(ledger.projection.physicalDefenseBody, '$.projection.physicalDefenseBody');
    check(ledger.projection.magicalDefenseMind, '$.projection.magicalDefenseMind');

    return { valid: issues.length === 0, issues };
};

export const COMBAT_NUMBER_FORMULA_SCALE = SCALED_IDENTITY;

export const evaluateCombatNumericFormula = (
    formula: CombatNumberFormula,
    trinity: TrinityStats
): number => {
    if (formula.kind === 'constant') {
        return fromFixedPoint(formula.scaledValue);
    }
    if (formula.kind === 'attribute_ratio') {
        const source = Math.max(0, Number(trinity[formula.attribute] || 0));
        const raw = fromFixedPoint(formula.scaledBase) + Math.round(source / Math.max(1e-9, Number(formula.divisor || 1)));
        const rounded = applyRoundMode(raw, formula.round);
        return Math.max(formula.minimum ?? 0, rounded);
    }
    if (formula.kind === 'attribute_threshold') {
        const source = Math.max(0, Number(trinity[formula.attribute] || 0));
        return source >= formula.threshold ? formula.above : formula.below;
    }
    const raw = formula.terms.reduce(
        (sum, term) => sum + (Math.max(0, Number(trinity[term.attribute] || 0)) * fromFixedPoint(term.scaledCoefficient)),
        fromFixedPoint(formula.scaledBase || 0)
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
