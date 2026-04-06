import type { Actor } from '../../types';
import type { StatusID } from '../../types/registry';
import type { TrinityComponent, StatsComponent } from '../components';
import { getComponent } from '../components';
import {
    resolveTrinityLevers,
    computeSparkCostFromTrinity,
    type TrinityStats
} from './trinity-resolver';
import {
    COMBAT_COEFFICIENTS_VERSION,
    resolveDefenseProjectionCoefficients,
    resolveHitQualityCoefficients,
    type ProjectionCoefficientSet
} from './combat-coefficients';
import { calculateBaseMagicalDamage } from './base-magical-damage';
import { calculateBasePhysicalDamage } from './base-physical-damage';
import { calculateCriticalOutcome } from './critical-outcome';
import { calculateHitQuality, type HitQualityTier, type TrackingSignature } from './hit-quality';
import { calculateStatusOutcome } from './status-outcome';
import { calculateInitiativeScore } from './initiative-formula';
import { resolveCombatRuleset } from './combat-ruleset';
import type { CombatRulesetVersion } from '../../types';
import { resolveCombatTuning } from '../../data/combat-tuning-ledger';
export type { TrinityStats } from './trinity-resolver';

export type CombatAttribute = 'body' | 'mind' | 'instinct';

export interface CombatScalingTerm {
    attribute: CombatAttribute;
    coefficient: number;
}

export interface CombatStatusMultiplier {
    id: StatusID | string;
    multiplier: number;
}

export interface CombatIntent {
    attackerId: string;
    targetId: string;
    skillId: string;
    basePower: number;
    basePowerPhys?: number;
    basePowerMag?: number;
    skillDamageMultiplier?: number;
    trinity: TrinityStats;
    statusMultipliers: CombatStatusMultiplier[];
    damageClass?: 'physical' | 'magical' | 'true';
    combat?: {
        damageClass: 'physical' | 'magical' | 'true';
        attackProfile: 'melee' | 'projectile' | 'spell' | 'status';
        trackingSignature: TrackingSignature;
        weights: Partial<Record<CombatAttribute, number>>;
    };
    targetTrinity?: TrinityStats;
    interactionModel?: 'legacy' | 'triangle';
    inDangerPreviewHex?: boolean;
    proximityDistance?: number;
    theoreticalMaxPower?: number;
    attackPowerMultiplier?: number;
    targetDamageTakenMultiplier?: number;
    engagementRange?: number;
    optimalRangeMin?: number;
    optimalRangeMax?: number;
    targetOptimalRangeMin?: number;
    targetOptimalRangeMax?: number;
    combatRulesetVersion?: CombatRulesetVersion;
    attackProfile?: 'melee' | 'projectile' | 'spell' | 'status';
    trackingSignature?: TrackingSignature;
    statusProfile?: { procBase: number; potencyBase: number; durationBase: number };
    canMultiCrit?: boolean;
    critTierCap?: number;
    /** Legacy compatibility for older tests and helper callers; ignored by the live layered path. */
    scaling?: Array<{ attribute: CombatAttribute; coefficient: number }>;
    engagementContext?: { distance: number; losOpen?: boolean };
    projectionCoefficients?: {
        physicalAttack?: Partial<ProjectionCoefficientSet>;
        magicalAttack?: Partial<ProjectionCoefficientSet>;
        physicalDefense?: Partial<ProjectionCoefficientSet>;
        magicalDefense?: Partial<ProjectionCoefficientSet>;
    };
    hitQualityCoefficients?: {
        hqFloor?: number;
        melee?: {
            attackerInstinct?: number;
            defenderInstinct?: number;
            adjacency?: number;
        };
        projectile?: {
            attackerInstinct?: number;
            defenderInstinct?: number;
            range?: number;
        };
        spell?: {
            attackerMind?: number;
            defenderInstinct?: number;
            distanceDodge?: number;
        };
    };
}

export interface CombatScoreEvent {
    skillId: string;
    attackerId: string;
    targetId: string;
    finalPower?: number;
    efficiency: number;
    riskBonusApplied: boolean;
    damageClass: 'physical' | 'magical';
    hitPressure: number;
    mitigationPressure: number;
    rangePressure: number;
    critPressure: number;
    resistancePressure: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
    traitOutgoingMultiplier?: number;
    traitIncomingMultiplier?: number;
    traitTotalMultiplier?: number;
    rulesetVersion?: CombatRulesetVersion;
    qualityTier?: HitQualityTier;
    trackingSignature?: TrackingSignature;
    baseDamagePressure?: number;
    defensePressure?: number;
    statusPressure?: number;
    attackProjection?: number;
    defenseProjection?: number;
    hqPressureAtt?: number;
    hqPressureDef?: number;
    coefficientsVersion?: string;
}

export interface CombatCalculationResult {
    basePower: number;
    bodyScaledPower: number;
    scalingPower: number;
    statusMultiplier: number;
    riskMultiplier: number;
    criticalMultiplier: number;
    hitMultiplier: number;
    rangeMultiplier: number;
    mitigationMultiplier: number;
    critExpectedMultiplier: number;
    finalPower: number;
    finalDamageBeforeFloor: number;
    finalDamageAfterMinimum: number;
    basePhysicalDamage?: number;
    baseMagicalDamage?: number;
    hitQualityScore: number;
    hitQualityTier: HitQualityTier;
    critChance: number;
    critSeverity: number;
    critTiersApplied: number;
    statusProcChance?: number;
    statusPotencyScalar?: number;
    rulesetVersion: CombatRulesetVersion;
    attackProjection?: number;
    defenseProjection?: number;
    hqPressureAtt?: number;
    hqPressureDef?: number;
    coefficientsVersion?: string;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
    scoreEvent: CombatScoreEvent;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const computeStatusMultiplier = (multipliers: CombatStatusMultiplier[]): number => {
    if (multipliers.length === 0) return 1;
    return multipliers.reduce((acc, m) => acc * m.multiplier, 1);
};

const projectTrinityValue = (
    trinity: TrinityStats,
    coefficients: ProjectionCoefficientSet
): number => (
    (Math.max(0, trinity.body) * coefficients.body)
    + (Math.max(0, trinity.instinct) * coefficients.instinct)
    + (Math.max(0, trinity.mind) * coefficients.mind)
);

const mergeProjectionCoefficients = (
    base: ProjectionCoefficientSet,
    overrides?: Partial<ProjectionCoefficientSet>
): ProjectionCoefficientSet => ({
    body: overrides?.body ?? base.body,
    instinct: overrides?.instinct ?? base.instinct,
    mind: overrides?.mind ?? base.mind
});


const resolveCombatWeights = (
    intent: CombatIntent
): { body: number; mind: number; instinct: number } => {
    const weights = intent.combat?.weights;
    if (weights) {
        return {
            body: Number(weights.body ?? 0),
            mind: Number(weights.mind ?? 0),
            instinct: Number(weights.instinct ?? 0)
        };
    }
    if ((intent.attackProfile || intent.combat?.attackProfile) === 'projectile') {
        return { body: 0, mind: 0, instinct: 1 };
    }
    if ((intent.attackProfile || intent.combat?.attackProfile) === 'spell') {
        return { body: 0, mind: 1, instinct: 0 };
    }
    return { body: 1, mind: 0, instinct: 0 };
};

const computeTrinityContributions = (
    intent: CombatIntent,
    attackProjection: number,
    defenseProjection: number,
    criticalMultiplier: number,
    effectiveBasePower: number,
    perPointMultipliers: {
        body: number;
        mind: number;
        instinct: number;
    }
): { body: number; mind: number; instinct: number } => {
    const weights = resolveCombatWeights(intent);
    const bodyScaling = (intent.trinity.body || 0) * perPointMultipliers.body * weights.body;
    const mindScaling = (intent.trinity.mind || 0) * perPointMultipliers.mind * weights.mind;
    const instinctScaling = (intent.trinity.instinct || 0) * perPointMultipliers.instinct * weights.instinct;

    const bodyPrimary = intent.damageClass === 'physical'
        ? Math.max(0, attackProjection - effectiveBasePower)
        : Math.max(0, defenseProjection);
    const mindPrimary = intent.damageClass === 'magical'
        ? Math.max(0, attackProjection - effectiveBasePower)
        : 0;
    const instinctCritLift = Math.max(0, (criticalMultiplier - 1) * attackProjection);

    return {
        body: Math.max(0, bodyPrimary + bodyScaling),
        mind: Math.max(0, mindPrimary + mindScaling),
        instinct: Math.max(0, instinctScaling + instinctCritLift),
    };
};

export const computeStatusDuration = (baseDuration: number, trinity: TrinityStats): number => {
    if (baseDuration <= 0) return baseDuration;
    const bonus = resolveTrinityLevers(trinity).mindStatusDurationBonus;
    return baseDuration + bonus;
};

export const computeInitiativeBonus = (trinity: TrinityStats): number => {
    return resolveTrinityLevers(trinity).instinctInitiativeBonus;
};

export const computeCriticalMultiplier = (trinity: TrinityStats): number => {
    return resolveTrinityLevers(trinity).instinctCriticalMultiplier;
};

export const computeSparkCost = (moveIndex: number, trinity: TrinityStats): number => {
    return computeSparkCostFromTrinity(moveIndex, trinity);
};

export const calculateCombat = (intent: CombatIntent): CombatCalculationResult => {
    const rulesetVersion = intent.combatRulesetVersion || resolveCombatRuleset(undefined);
    const damageClass = intent.damageClass || intent.combat?.damageClass || 'physical';
    const effectiveDamageClass: 'physical' | 'magical' = damageClass === 'magical' ? 'magical' : 'physical';
    const defender = intent.targetTrinity || { body: 0, mind: 0, instinct: 0 };
    const tuning = resolveCombatTuning(intent.skillId);
    const trackingSignature: TrackingSignature = intent.trackingSignature
        || intent.combat?.trackingSignature
        || (intent.attackProfile === 'projectile' ? 'projectile'
            : intent.attackProfile === 'spell' ? 'magic'
                : damageClass === 'magical' ? 'magic'
                    : 'melee');
    const rawBasePower = damageClass === 'magical'
        ? (intent.basePowerMag ?? intent.basePower)
        : (intent.basePowerPhys ?? intent.basePower);
    const basePowerProjection = rawBasePower * tuning.trinityLevers.basePowerMultiplier;
    const skillDamageMultiplier = Number.isFinite(intent.skillDamageMultiplier)
        ? Number(intent.skillDamageMultiplier)
        : 1;
    const weights = resolveCombatWeights(intent);
    const effectiveBodyMultiplier = tuning.trinityLevers.bodyDamageMultiplierPerPoint * skillDamageMultiplier * weights.body;
    const effectiveMindMultiplier = tuning.trinityLevers.mindDamageMultiplierPerPoint * skillDamageMultiplier * weights.mind;
    const effectiveInstinctMultiplier = tuning.trinityLevers.instinctDamageMultiplierPerPoint * skillDamageMultiplier * weights.instinct;
    const scalingPower = (
        (Math.max(0, intent.trinity.body || 0) * effectiveBodyMultiplier)
        + (Math.max(0, intent.trinity.mind || 0) * effectiveMindMultiplier)
        + (Math.max(0, intent.trinity.instinct || 0) * effectiveInstinctMultiplier)
    );
    const defenseCoefficients = damageClass === 'magical'
        ? mergeProjectionCoefficients(
            resolveDefenseProjectionCoefficients('magical'),
            intent.projectionCoefficients?.magicalDefense
        )
        : mergeProjectionCoefficients(
            resolveDefenseProjectionCoefficients('physical'),
            intent.projectionCoefficients?.physicalDefense
        );
    const projectedAttack = basePowerProjection + scalingPower;
    const projectedDefense = projectTrinityValue(defender, defenseCoefficients);
    const baseDamage = effectiveDamageClass === 'magical'
        ? calculateBaseMagicalDamage({
            attackProjection: projectedAttack,
            defenseProjection: projectedDefense
        })
        : calculateBasePhysicalDamage({
            attackProjection: projectedAttack,
            defenseProjection: projectedDefense
        });
    const hqCoefficients = resolveHitQualityCoefficients(trackingSignature);
    const hitQuality = calculateHitQuality({
        attackerInstinct: intent.trinity.instinct,
        attackerMind: intent.trinity.mind,
        defenderInstinct: defender.instinct,
        trackingSignature,
        distance: intent.engagementContext?.distance ?? intent.engagementRange,
        canMultiCrit: intent.canMultiCrit,
        hqFloor: intent.hitQualityCoefficients?.hqFloor ?? hqCoefficients.hqFloor,
        meleeAttackerInstinctCoefficient: intent.hitQualityCoefficients?.melee?.attackerInstinct ?? ('attackerInstinct' in hqCoefficients ? hqCoefficients.attackerInstinct : undefined),
        meleeDefenderInstinctCoefficient: intent.hitQualityCoefficients?.melee?.defenderInstinct ?? ('defenderInstinct' in hqCoefficients ? hqCoefficients.defenderInstinct : undefined),
        meleeAdjacencyCoefficient: intent.hitQualityCoefficients?.melee?.adjacency ?? ('adjacency' in hqCoefficients ? hqCoefficients.adjacency : undefined),
        projectileAttackerInstinctCoefficient: intent.hitQualityCoefficients?.projectile?.attackerInstinct ?? ('attackerInstinct' in hqCoefficients ? hqCoefficients.attackerInstinct : undefined),
        projectileDefenderInstinctCoefficient: intent.hitQualityCoefficients?.projectile?.defenderInstinct ?? ('defenderInstinct' in hqCoefficients ? hqCoefficients.defenderInstinct : undefined),
        projectileRangeCoefficient: intent.hitQualityCoefficients?.projectile?.range ?? ('range' in hqCoefficients ? hqCoefficients.range : undefined),
        spellAttackerMindCoefficient: intent.hitQualityCoefficients?.spell?.attackerMind ?? ('attackerMind' in hqCoefficients ? hqCoefficients.attackerMind : undefined),
        spellDefenderInstinctCoefficient: intent.hitQualityCoefficients?.spell?.defenderInstinct ?? ('defenderInstinct' in hqCoefficients ? hqCoefficients.defenderInstinct : undefined),
        spellDistanceDodgeCoefficient: intent.hitQualityCoefficients?.spell?.distanceDodge ?? ('distanceDodge' in hqCoefficients ? hqCoefficients.distanceDodge : undefined)
    });
    const crit = calculateCriticalOutcome({
        hitQualityTier: hitQuality.tier,
        attackerInstinct: intent.trinity.instinct,
        defenderBody: defender.body,
        canMultiCrit: intent.canMultiCrit,
        critTierCap: intent.critTierCap
    });
    const status = intent.statusProfile
        ? calculateStatusOutcome({
            attackerMind: intent.trinity.mind,
            defenderMind: defender.mind,
            procBase: intent.statusProfile.procBase,
            potencyBase: intent.statusProfile.potencyBase,
            durationBase: intent.statusProfile.durationBase
        })
        : undefined;
    const statusMultiplier = computeStatusMultiplier(intent.statusMultipliers);
    const rawDamage = baseDamage
        * hitQuality.scalar
        * crit.damageMultiplier
        * statusMultiplier
        * (intent.attackPowerMultiplier ?? 1)
        * (intent.targetDamageTakenMultiplier ?? 1);
    const finalPower = hitQuality.tier === 'miss'
        ? 0
        : rawDamage > 0
            ? Math.max(1, Math.floor(rawDamage))
            : 0;
    const rawContrib = computeTrinityContributions(
        intent,
        projectedAttack,
        projectedDefense,
        crit.damageMultiplier,
        basePowerProjection,
        {
            body: effectiveBodyMultiplier,
            mind: effectiveMindMultiplier,
            instinct: effectiveInstinctMultiplier
        }
    );
    const contribTotal = Math.max(1e-6, rawContrib.body + rawContrib.mind + rawContrib.instinct);
    const bodyContribution = round3(rawContrib.body / contribTotal);
    const mindContribution = round3(rawContrib.mind / contribTotal);
    const instinctContribution = round3(rawContrib.instinct / contribTotal);
    const theoreticalMax = Math.max(1, intent.theoreticalMaxPower ?? rawDamage);
    const efficiency = clamp(finalPower / theoreticalMax, 0, 1);

    return {
            basePower: intent.basePower,
            bodyScaledPower: round3(baseDamage),
            scalingPower: round3(scalingPower),
            statusMultiplier: round3(statusMultiplier),
            riskMultiplier: 1,
            criticalMultiplier: round3(crit.damageMultiplier),
            hitMultiplier: round3(hitQuality.scalar),
            rangeMultiplier: round3(hitQuality.effectiveRatio),
            mitigationMultiplier: 1,
            critExpectedMultiplier: round3(crit.damageMultiplier),
            finalPower,
            finalDamageBeforeFloor: round3(rawDamage),
            finalDamageAfterMinimum: finalPower,
            basePhysicalDamage: effectiveDamageClass === 'physical' ? round3(baseDamage) : undefined,
            baseMagicalDamage: effectiveDamageClass === 'magical' ? round3(baseDamage) : undefined,
            hitQualityScore: round3(hitQuality.effectiveRatio),
            hitQualityTier: hitQuality.tier,
            critChance: round3(crit.critChance),
            critSeverity: round3(crit.critSeverity),
            critTiersApplied: crit.critTiersApplied,
            statusProcChance: status ? round3(status.statusProcChance) : undefined,
            statusPotencyScalar: status ? round3(status.statusPotencyScalar) : undefined,
            rulesetVersion,
            attackProjection: round3(projectedAttack),
            defenseProjection: round3(projectedDefense),
            hqPressureAtt: round3(hitQuality.pressureAtt),
            hqPressureDef: round3(hitQuality.pressureDef),
            coefficientsVersion: COMBAT_COEFFICIENTS_VERSION,
            bodyContribution,
            mindContribution,
            instinctContribution,
            scoreEvent: {
                skillId: intent.skillId,
                attackerId: intent.attackerId,
                targetId: intent.targetId,
                finalPower,
                efficiency: round3(efficiency),
                riskBonusApplied: false,
                damageClass: effectiveDamageClass,
                hitPressure: round3(hitQuality.rawRatio),
                mitigationPressure: round3(damageClass === 'magical' ? defender.mind * 0.5 : defender.body * 0.2),
                rangePressure: round3((intent.engagementContext?.distance ?? intent.engagementRange ?? 0)),
                critPressure: round3(crit.critChance),
                resistancePressure: round3(Math.max(0, defender.body * 0.05)),
                bodyContribution,
                mindContribution,
                instinctContribution,
                rulesetVersion,
                qualityTier: hitQuality.tier,
                trackingSignature,
                baseDamagePressure: round3(baseDamage),
                defensePressure: round3(projectedDefense),
                statusPressure: status ? round3(status.mindRatio) : 0,
                attackProjection: round3(projectedAttack),
                defenseProjection: round3(projectedDefense),
                hqPressureAtt: round3(hitQuality.pressureAtt),
                hqPressureDef: round3(hitQuality.pressureDef),
                coefficientsVersion: COMBAT_COEFFICIENTS_VERSION
            }
        };
};

export class GrandCalculator {
    static resolveCombat(intent: CombatIntent): CombatCalculationResult {
        return calculateCombat(intent);
    }

    static resolveStatusDuration(baseDuration: number, trinity: TrinityStats): number {
        return computeStatusDuration(baseDuration, trinity);
    }

    static resolveInitiativeBonus(trinity: TrinityStats): number {
        return computeInitiativeBonus(trinity);
    }

    static resolveInitiativeScore(input: { instinct: number; mind: number; speedModifier?: number }): number {
        return calculateInitiativeScore(input);
    }

    static resolveCriticalMultiplier(trinity: TrinityStats): number {
        return computeCriticalMultiplier(trinity);
    }

    static resolveSparkCost(moveIndex: number, trinity: TrinityStats): number {
        return computeSparkCost(moveIndex, trinity);
    }
}

export const extractTrinityStats = (actor: Actor): TrinityStats => {
    const trinity = getComponent<TrinityComponent>(actor.components, 'trinity');
    if (trinity) {
        return {
            body: trinity.body,
            mind: trinity.mind,
            instinct: trinity.instinct
        };
    }
    const stats = getComponent<StatsComponent>(actor.components, 'stats');
    const body = stats?.strength ?? 0;
    const mind = stats?.defense ?? 0;
    const instinct = stats?.evasion ?? 0;
    return { body, mind, instinct };
};
