import type { Actor, GameState, Point } from '../../types';
import { getDirectionFromTo, hexDirection } from '../../hex';
import { getSurfaceSkillPowerMultiplier, getSurfaceStatus } from '../tiles/surface-status';
import type { CollisionResolutionPolicy } from '../combat/collision-policy';
import type { ResolutionTraceEntry, SkillPhysicsPlan } from './types';

export const toCollisionPolicy = (
    instructionPolicy: SkillPhysicsPlan['collision'] | undefined,
    contextPolicy: SkillPhysicsPlan['collision'] | undefined,
    physicsPlan: SkillPhysicsPlan
): CollisionResolutionPolicy | undefined => {
    const policy = instructionPolicy || contextPolicy || physicsPlan.collision;
    if (!policy) return undefined;
    return {
        onBlocked: policy.onBlocked,
        crushDamage: policy.crushDamage,
        damageReason: policy.damageReason,
        applyStunOnStop: policy.applyStunOnStop,
        stunDuration: policy.stunDuration
    };
};

export const adjustMagnitudeForWeightClass = (
    baseMagnitude: number,
    actor: Actor | undefined,
    physicsPlan: SkillPhysicsPlan,
    emitTrace: (entry: ResolutionTraceEntry) => void,
    path: string
): number => {
    const weightClass = actor?.weightClass;
    if (!weightClass || !physicsPlan.weightClassModifierTable) return baseMagnitude;
    const modifier = Number(physicsPlan.weightClassModifierTable[weightClass] || 0);
    const adjusted = baseMagnitude + modifier;
    if (modifier !== 0) {
        emitTrace({
            kind: 'physics',
            path,
            message: `Adjusted magnitude by ${modifier} for ${weightClass} target.`,
            before: baseMagnitude,
            after: adjusted,
            metadata: { weightClass }
        });
    }
    return adjusted;
};

export const resolveRuntimeStatusMultipliers = (
    state: GameState,
    selectedPoint: Point,
    sources: Array<{ type: 'surface_skill_power'; skillId: string }> | undefined
): Array<{ id: string; multiplier: number }> => {
    const multipliers: Array<{ id: string; multiplier: number }> = [];
    for (const source of sources || []) {
        if (source.type !== 'surface_skill_power') continue;
        const surfaceStatus = getSurfaceStatus(state, selectedPoint);
        const multiplier = getSurfaceSkillPowerMultiplier(source.skillId as any, surfaceStatus);
        if (multiplier !== 1) {
            multipliers.push({
                id: `surface_${surfaceStatus}`,
                multiplier
            });
        }
    }
    return multipliers;
};

export interface DirectionResolutionContext {
    initialCasterPosition: Point;
    selectedHex?: Point;
}

export const resolveDirectionVector = (
    direction: 'source_to_target' | 'target_to_source',
    context: DirectionResolutionContext
): Point | undefined => {
    const source = context.initialCasterPosition;
    const target = context.selectedHex;
    if (!target) return undefined;
    const forwardIndex = getDirectionFromTo(source, target);
    if (forwardIndex === -1) return undefined;
    const forward = hexDirection(forwardIndex);
    return direction === 'source_to_target'
        ? forward
        : { q: -forward.q, r: -forward.r, s: -forward.s };
};
