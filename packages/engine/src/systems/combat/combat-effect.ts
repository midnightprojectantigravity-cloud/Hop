import type { Actor, AtomicEffect, Point } from '../../types';
import type { CombatCalculationResult, CombatIntent, CombatStatusMultiplier } from './combat-calculator';
import { calculateCombat, extractTrinityStats } from './combat-calculator';
import type {
    CombatDamageElement,
    CombatDamageSubClass
} from './damage-taxonomy';

export interface ResolveSkillCombatDamageInput {
    attacker: Actor;
    target?: Actor;
    targetId?: string;
    skillId: string;
    reason?: string;
    basePower?: number;
    basePowerPhys?: number;
    basePowerMag?: number;
    skillDamageMultiplier?: number;
    statusMultipliers?: CombatStatusMultiplier[];
    damageClass?: CombatIntent['damageClass'];
    combat?: CombatIntent['combat'];
    leechRatio?: number;
    attackProfile?: CombatIntent['attackProfile'];
    weights?: CombatIntent['combat'] extends infer T
        ? T extends { weights: infer W }
            ? W
            : never
        : never;
    damageSubClass?: CombatDamageSubClass;
    damageElement?: CombatDamageElement;
    trackingSignature?: CombatIntent['trackingSignature'];
    engagementContext?: CombatIntent['engagementContext'];
    engagementRange?: number;
    targetDamageTakenMultiplier?: number;
    attackPowerMultiplier?: number;
    inDangerPreviewHex?: boolean;
    theoreticalMaxPower?: number;
    targetTrinity?: CombatIntent['targetTrinity'];
}

export const resolveSkillCombatDamage = (input: ResolveSkillCombatDamageInput): CombatCalculationResult =>
    ({
        ...calculateCombat({
        attackerId: input.attacker.id,
        targetId: input.targetId ?? input.target?.id ?? 'targetActor',
        skillId: input.skillId,
        basePower: input.basePower ?? 0,
        basePowerPhys: input.basePowerPhys,
        basePowerMag: input.basePowerMag,
        skillDamageMultiplier: input.skillDamageMultiplier ?? 1,
        trinity: extractTrinityStats(input.attacker),
        targetTrinity: input.targetTrinity ?? (input.target ? extractTrinityStats(input.target) : undefined),
        statusMultipliers: input.statusMultipliers ?? [],
        damageClass: input.damageClass,
        damageSubClass: input.damageSubClass,
        damageElement: input.damageElement,
        combat: input.combat
            ? (
                input.weights
                    ? {
                        ...input.combat,
                        weights: input.weights
                    }
                    : input.combat
            )
            : undefined,
        attackProfile: input.attackProfile,
        trackingSignature: input.trackingSignature,
        engagementContext: input.engagementContext,
        engagementRange: input.engagementRange,
        targetDamageTakenMultiplier: input.targetDamageTakenMultiplier,
        attackPowerMultiplier: input.attackPowerMultiplier,
        inDangerPreviewHex: input.inDangerPreviewHex,
        theoreticalMaxPower: input.theoreticalMaxPower
    }),
        leechRatio: input.leechRatio ?? input.combat?.leechRatio ?? 0
    });

export const createDamageEffectFromCombat = (
    combat: CombatCalculationResult,
    target: string | Point,
    reason?: string
): AtomicEffect => ({
    type: 'Damage',
    target: target as any,
    amount: combat.finalPower,
    reason,
    scoreEvent: combat.scoreEvent,
    damageClass: combat.damageClass,
    damageSubClass: combat.damageSubClass,
    damageElement: combat.damageElement,
    leechRatio: combat.leechRatio
});
