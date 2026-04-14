import { SCALED_IDENTITY } from '../constants';
import type { CombatTuningVariables } from './combat-tuning-ledger';

export interface FixedPointMigrationWarning {
    path: string;
    original: number;
    scaled: number;
    precisionLoss: boolean;
}

export interface FixedPointMigrationResult<T> {
    value: T;
    warnings: FixedPointMigrationWarning[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const scaleValue = (value: number, path: string, warnings: FixedPointMigrationWarning[]): number => {
    const scaled = Math.round(value * SCALED_IDENTITY);
    const precisionLoss = Math.abs((value * SCALED_IDENTITY) - scaled) > 1e-9;
    warnings.push({
        path,
        original: value,
        scaled,
        precisionLoss
    });
    if (!Number.isSafeInteger(scaled)) {
        throw new Error(`Scaled value for ${path} exceeds safe integer range`);
    }
    return scaled;
};

export const migrateCombatTuningLedgerPayload = (
    input: unknown
): FixedPointMigrationResult<CombatTuningVariables> => {
    if (!isRecord(input)) {
        throw new Error('Expected combat tuning ledger object');
    }

    const warnings: FixedPointMigrationWarning[] = [];
    const trinityHp = isRecord(input.trinityHp) ? input.trinityHp : {};
    const trinityLevers = isRecord(input.trinityLevers) ? input.trinityLevers : {};
    const hitQuality = isRecord(input.hitQuality) ? input.hitQuality : {};
    const critical = isRecord(input.critical) ? input.critical : {};
    const status = isRecord(input.status) ? input.status : {};
    const initiative = isRecord(input.initiative) ? input.initiative : {};
    const projection = isRecord(input.projection) ? input.projection : {};
    const enemyCombat = isRecord(input.enemyCombat) ? input.enemyCombat : {};
    const hitQualityMelee = isRecord(hitQuality.melee) ? hitQuality.melee : {};
    const hitQualityProjectile = isRecord(hitQuality.projectile) ? hitQuality.projectile : {};
    const hitQualitySpell = isRecord(hitQuality.spell) ? hitQuality.spell : {};

    const value = {
        coefficientScale: SCALED_IDENTITY,
        trinityHp: {
            base: scaleValue(Number(trinityHp.base ?? 0), '$.trinityHp.base', warnings),
            body: scaleValue(Number(trinityHp.body ?? 0), '$.trinityHp.body', warnings),
            mind: scaleValue(Number(trinityHp.mind ?? 0), '$.trinityHp.mind', warnings),
            instinct: scaleValue(Number(trinityHp.instinct ?? 0), '$.trinityHp.instinct', warnings)
        },
        trinityLevers: {
            basePowerMultiplier: scaleValue(Number(trinityLevers.basePowerMultiplier ?? 0), '$.trinityLevers.basePowerMultiplier', warnings),
            bodyDamageMultiplierPerPoint: scaleValue(Number(trinityLevers.bodyDamageMultiplierPerPoint ?? 0), '$.trinityLevers.bodyDamageMultiplierPerPoint', warnings),
            mindDamageMultiplierPerPoint: scaleValue(Number(trinityLevers.mindDamageMultiplierPerPoint ?? 0), '$.trinityLevers.mindDamageMultiplierPerPoint', warnings),
            instinctDamageMultiplierPerPoint: scaleValue(Number(trinityLevers.instinctDamageMultiplierPerPoint ?? 0), '$.trinityLevers.instinctDamageMultiplierPerPoint', warnings),
            bodyMitigationPerPoint: scaleValue(Number(trinityLevers.bodyMitigationPerPoint ?? 0), '$.trinityLevers.bodyMitigationPerPoint', warnings),
            bodyMitigationCap: scaleValue(Number(trinityLevers.bodyMitigationCap ?? 0), '$.trinityLevers.bodyMitigationCap', warnings),
            mindStatusDurationDivisor: Number(trinityLevers.mindStatusDurationDivisor ?? 0),
            mindMagicMultiplierPerPoint: scaleValue(Number(trinityLevers.mindMagicMultiplierPerPoint ?? 0), '$.trinityLevers.mindMagicMultiplierPerPoint', warnings),
            instinctInitiativeBonusPerPoint: scaleValue(Number(trinityLevers.instinctInitiativeBonusPerPoint ?? 0), '$.trinityLevers.instinctInitiativeBonusPerPoint', warnings),
            instinctCriticalMultiplierPerPoint: scaleValue(Number(trinityLevers.instinctCriticalMultiplierPerPoint ?? 0), '$.trinityLevers.instinctCriticalMultiplierPerPoint', warnings),
            instinctCriticalMultiplierCap: Number(trinityLevers.instinctCriticalMultiplierCap ?? 0),
            instinctSparkDiscountPerPoint: scaleValue(Number(trinityLevers.instinctSparkDiscountPerPoint ?? 0), '$.trinityLevers.instinctSparkDiscountPerPoint', warnings),
            instinctSparkDiscountCap: Number(trinityLevers.instinctSparkDiscountCap ?? 0)
        },
        hitQuality: {
            floor: scaleValue(Number(hitQuality.floor ?? 0), '$.hitQuality.floor', warnings),
            melee: {
                attackerInstinct: scaleValue(Number(hitQualityMelee.attackerInstinct ?? 0), '$.hitQuality.melee.attackerInstinct', warnings),
                defenderInstinct: scaleValue(Number(hitQualityMelee.defenderInstinct ?? 0), '$.hitQuality.melee.defenderInstinct', warnings),
                adjacency: scaleValue(Number(hitQualityMelee.adjacency ?? 0), '$.hitQuality.melee.adjacency', warnings)
            },
            projectile: {
                attackerInstinct: scaleValue(Number(hitQualityProjectile.attackerInstinct ?? 0), '$.hitQuality.projectile.attackerInstinct', warnings),
                defenderInstinct: scaleValue(Number(hitQualityProjectile.defenderInstinct ?? 0), '$.hitQuality.projectile.defenderInstinct', warnings),
                range: scaleValue(Number(hitQualityProjectile.range ?? 0), '$.hitQuality.projectile.range', warnings)
            },
            spell: {
                attackerMind: scaleValue(Number(hitQualitySpell.attackerMind ?? 0), '$.hitQuality.spell.attackerMind', warnings),
                defenderInstinct: scaleValue(Number(hitQualitySpell.defenderInstinct ?? 0), '$.hitQuality.spell.defenderInstinct', warnings),
                distanceDodge: scaleValue(Number(hitQualitySpell.distanceDodge ?? 0), '$.hitQuality.spell.distanceDodge', warnings)
            },
            missThreshold: Number(hitQuality.missThreshold ?? 0),
            glancingThreshold: Number(hitQuality.glancingThreshold ?? 0),
            normalThreshold: Number(hitQuality.normalThreshold ?? 0),
            criticalThreshold: Number(hitQuality.criticalThreshold ?? 0)
        },
        critical: {
            baseSeverity: scaleValue(Number(critical.baseSeverity ?? 0), '$.critical.baseSeverity', warnings),
            minSeverity: scaleValue(Number(critical.minSeverity ?? 0), '$.critical.minSeverity', warnings),
            bodyResiliencePerPoint: scaleValue(Number(critical.bodyResiliencePerPoint ?? 0), '$.critical.bodyResiliencePerPoint', warnings),
            critChanceLogDivisor: Number(critical.critChanceLogDivisor ?? 0)
        },
        status: {
            minProcChance: scaleValue(Number(status.minProcChance ?? 0), '$.status.minProcChance', warnings),
            minPotencyScalar: scaleValue(Number(status.minPotencyScalar ?? 0), '$.status.minPotencyScalar', warnings),
            minDuration: Number(status.minDuration ?? 0)
        },
        initiative: {
            instinctCoefficient: scaleValue(Number(initiative.instinctCoefficient ?? 0), '$.initiative.instinctCoefficient', warnings),
            mindCoefficient: scaleValue(Number(initiative.mindCoefficient ?? 0), '$.initiative.mindCoefficient', warnings)
        },
        projection: {
            physicalDefenseBody: scaleValue(Number(projection.physicalDefenseBody ?? 0), '$.projection.physicalDefenseBody', warnings),
            magicalDefenseMind: scaleValue(Number(projection.magicalDefenseMind ?? 0), '$.projection.magicalDefenseMind', warnings)
        },
        enemyCombat: {
            bossTrinityTotalThreshold: Number(enemyCombat.bossTrinityTotalThreshold ?? 0),
            highInstinctThreshold: Number(enemyCombat.highInstinctThreshold ?? 0),
            boostedSpeed: Number(enemyCombat.boostedSpeed ?? 0),
            baseSpeed: Number(enemyCombat.baseSpeed ?? 0),
            baseActionCooldown: Number(enemyCombat.baseActionCooldown ?? 0),
            hazardActionCooldown: Number(enemyCombat.hazardActionCooldown ?? 0),
            bossActionCooldown: Number(enemyCombat.bossActionCooldown ?? 0)
        }
    } satisfies CombatTuningVariables;

    return { value, warnings };
};
