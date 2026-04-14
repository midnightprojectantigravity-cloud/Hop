import { describe, expect, it } from 'vitest';
import {
    COMBAT_TUNING_VARIABLES,
    validateCombatTuningLedger
} from '../data/combat-tuning-ledger';
import { migrateCombatTuningLedgerPayload } from '../data/fixed-point-migration';
import { formatFixedPoint } from '../data/fixed-point';

describe('fixed-point combat ledger', () => {
    it('stores the canonical scale and scaled coefficients', () => {
        expect(COMBAT_TUNING_VARIABLES.coefficientScale).toBe(10_000);
        expect(COMBAT_TUNING_VARIABLES.trinityLevers.bodyDamageMultiplierPerPoint).toBe(5_000);
        expect(COMBAT_TUNING_VARIABLES.projection.physicalDefenseBody).toBe(2_000);
    });

    it('rejects non-integer or overflowing scaled values', () => {
        const decimalLedger = {
            ...COMBAT_TUNING_VARIABLES,
            trinityLevers: {
                ...COMBAT_TUNING_VARIABLES.trinityLevers,
                bodyDamageMultiplierPerPoint: 5_000.5
            }
        };
        const overflowLedger = {
            ...COMBAT_TUNING_VARIABLES,
            trinityLevers: {
                ...COMBAT_TUNING_VARIABLES.trinityLevers,
                bodyDamageMultiplierPerPoint: Number.MAX_SAFE_INTEGER + 1
            }
        };

        expect(validateCombatTuningLedger(decimalLedger).valid).toBe(false);
        expect(validateCombatTuningLedger(decimalLedger).issues.some(issue => issue.path === '$.trinityLevers.bodyDamageMultiplierPerPoint')).toBe(true);

        const overflowResult = validateCombatTuningLedger(overflowLedger);
        expect(overflowResult.valid).toBe(false);

        const unsafeLedger = {
            ...COMBAT_TUNING_VARIABLES,
            coefficientScale: Number.MAX_SAFE_INTEGER + 1
        };
        expect(validateCombatTuningLedger(unsafeLedger).valid).toBe(false);
    });

    it('migrates legacy float ledger values into canonical fixed-point integers', () => {
        const migrated = migrateCombatTuningLedgerPayload({
            trinityHp: { base: 0, body: 6, mind: 1, instinct: 3 },
            trinityLevers: {
                basePowerMultiplier: 1,
                bodyDamageMultiplierPerPoint: 0.5,
                mindDamageMultiplierPerPoint: 0.5,
                instinctDamageMultiplierPerPoint: 0.5,
                bodyMitigationPerPoint: 0.01,
                bodyMitigationCap: 0.5,
                mindStatusDurationDivisor: 15,
                mindMagicMultiplierPerPoint: 0.3333333,
                instinctInitiativeBonusPerPoint: 2,
                instinctCriticalMultiplierPerPoint: 0.015,
                instinctCriticalMultiplierCap: 10,
                instinctSparkDiscountPerPoint: 0.01,
                instinctSparkDiscountCap: 100
            },
            hitQuality: {
                floor: 1,
                melee: { attackerInstinct: 1, defenderInstinct: 1, adjacency: 40 },
                projectile: { attackerInstinct: 1, defenderInstinct: 1, range: 0.08 },
                spell: { attackerMind: 1, defenderInstinct: 1, distanceDodge: 4 },
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
        });

        expect(migrated.value.trinityLevers.bodyDamageMultiplierPerPoint).toBe(5_000);
        expect(migrated.value.trinityLevers.mindMagicMultiplierPerPoint).toBe(3_333);
        expect(migrated.value.projection.magicalDefenseMind).toBe(5_000);
        expect(migrated.warnings.some(warning => warning.path === '$.trinityLevers.bodyDamageMultiplierPerPoint')).toBe(true);
        expect(migrated.warnings.some(warning => warning.precisionLoss)).toBe(true);
    });

    it('formats kernel values as human-friendly decimals', () => {
        expect(formatFixedPoint(425_000)).toBe('42.5000');
    });
});
