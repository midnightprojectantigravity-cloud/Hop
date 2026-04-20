import { hexDistance, hexEquals } from '../../hex';
import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import { createPointProxyTarget } from './actor-resolution';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../combat/combat-effect';
import { resolveRuntimeStatusMultipliers } from './physics-resolution';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';
import type { RuntimePointFilter, RuntimePointPattern, RuntimePointSet, RuntimeTargetFanOut, SkillRuntimeDefinition } from './types';

export type CombatMaterializationDeps = {
    resolveInstructionPointTargets: (
        target: any,
        pointSet: RuntimePointSet | undefined,
        pointPattern: RuntimePointPattern | undefined,
        targetFanOut: RuntimeTargetFanOut | undefined,
        pointFilters: RuntimePointFilter[] | undefined,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext,
        deps: PointResolutionDependencies
    ) => Array<{ actor?: Actor; effectTarget: Point | string; point: Point }>;
    resolveRuntimeSkillActorById: (state: GameState, actorId: string) => Actor | undefined;
    pointResolutionDeps: PointResolutionDependencies;
};

export const materializeDealDamageInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolved: { runtime: { id: string; baseVariables: { basePower?: number; damage?: number }; combat?: any } },
    deps: CombatMaterializationDeps
): AtomicEffect[] => {
    const targets = deps.resolveInstructionPointTargets(
        instruction.target,
        instruction.pointSet,
        instruction.pointPattern,
        instruction.targetFanOut,
        instruction.pointFilters,
        attacker,
        state,
        context,
        deps.pointResolutionDeps
    );
    if (targets.length === 0) return [];
    const effects: AtomicEffect[] = [];
    if (instruction.resolution === 'combat') {
        for (const resolvedTarget of targets) {
            const combatProfile = resolved.runtime.combat
                ? {
                    ...resolved.runtime.combat,
                    ...(instruction.damageClass ? { damageClass: instruction.damageClass } : {}),
                    ...(instruction.damageSubClass ? { damageSubClass: instruction.damageSubClass as any } : {}),
                    ...(instruction.damageElement ? { damageElement: instruction.damageElement as any } : {}),
                    ...(instruction.attackProfile ? { attackProfile: instruction.attackProfile } : {}),
                    ...(instruction.trackingSignature ? { trackingSignature: instruction.trackingSignature } : {}),
                    ...(instruction.weights ? { weights: { ...instruction.weights } } : {})
                }
                : undefined;
            const proxyTarget = createPointProxyTarget(attacker, resolvedTarget.point);
            const combatTarget = instruction.target === 'selected_hex'
                ? (instruction.combatPointTargetMode === 'proxy_actor'
                    ? proxyTarget
                    : instruction.combatPointTargetMode === 'actor_only'
                        ? resolvedTarget.actor
                        : (resolvedTarget.actor || proxyTarget))
                : (resolvedTarget.actor || proxyTarget);
            if (!combatTarget) continue;
            const combat = resolveSkillCombatDamage({
                attacker,
                target: combatTarget,
                skillId: resolved.runtime.id,
                basePower: instruction.basePower ?? resolved.runtime.baseVariables.basePower ?? 0,
                skillDamageMultiplier: instruction.skillDamageMultiplier ?? resolved.runtime.baseVariables.damage ?? 1,
                statusMultipliers: resolveRuntimeStatusMultipliers(state, resolvedTarget.point, instruction.statusMultiplierSources),
                damageClass: instruction.damageClass,
                damageSubClass: instruction.damageSubClass as any,
                damageElement: instruction.damageElement as any,
                combat: combatProfile,
                attackProfile: instruction.attackProfile,
                trackingSignature: instruction.trackingSignature,
                weights: instruction.weights || combatProfile?.weights,
                engagementContext: instruction.engagementContext || { distance: hexDistance(attacker.position, resolvedTarget.point) },
                inDangerPreviewHex: instruction.includeDangerPreviewHex
                    ? !!state.intentPreview?.dangerTiles?.some(point => hexEquals(point, attacker.position))
                    : undefined,
                theoreticalMaxPower: instruction.theoreticalMaxPower
            });
            effects.push(
                createDamageEffectFromCombat(
                    combat,
                    instruction.combatPointTargetMode === 'actor_only' && resolvedTarget.actor
                        ? resolvedTarget.actor.id
                        : resolvedTarget.effectTarget,
                    instruction.reason ?? (instruction.suppressReason ? undefined : resolved.runtime.id.toLowerCase())
                )
            );
        }
        return effects;
    }

    for (const resolvedTarget of targets) {
        effects.push({
            type: 'Damage',
            target: resolvedTarget.effectTarget,
            amount: instruction.amount ?? 0,
            reason: instruction.reason || resolved.runtime.id.toLowerCase(),
            damageClass: instruction.damageClass,
            damageSubClass: instruction.damageSubClass as any,
            damageElement: instruction.damageElement as any
        });
    }
    return effects;
};

export const materializeApplyAilmentInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: CombatMaterializationDeps
): AtomicEffect[] => {
    const targets = deps.resolveInstructionPointTargets(
        instruction.target,
        instruction.pointSet,
        instruction.pointPattern,
        instruction.targetFanOut,
        instruction.pointFilters,
        attacker,
        state,
        context,
        deps.pointResolutionDeps
    );
    const effects: AtomicEffect[] = [];
    for (const resolvedTarget of targets) {
        const ailmentTarget = instruction.target === 'selected_hex'
            ? resolvedTarget.actor?.id
            : typeof resolvedTarget.effectTarget === 'string'
                ? resolvedTarget.effectTarget
                : undefined;
        if (!ailmentTarget) continue;
        effects.push({
            type: 'ApplyAilment',
            target: ailmentTarget,
            ailment: instruction.ailment,
            skillMultiplier: instruction.skillMultiplier,
            baseDeposit: instruction.baseDeposit
        });
    }
    return effects;
};
