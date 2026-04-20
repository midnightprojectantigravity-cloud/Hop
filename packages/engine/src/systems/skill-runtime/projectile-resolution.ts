import { getHexLine } from '../../hex';
import type { Actor, GameState } from '../../types';
import { isBlockedByWall, validateLineOfSight } from '../validation';
import { resolveRuntimeSkillTargetActor } from './targeting';
import type { PointResolutionContext } from './point-resolution';
import type { SkillPhysicsPlan } from './types';
import { clonePoint } from './execution-context';

type ProjectileExecutionContext = PointResolutionContext & {
    collisionPolicy?: SkillPhysicsPlan['collision'];
    physicsPlan: SkillPhysicsPlan;
};

export const resolveProjectileTrace = (
    mode: 'point_or_wall' | 'target_actor',
    attacker: Actor,
    state: GameState,
    context: ProjectileExecutionContext,
    stopAtWalls: boolean = true,
    stopAtActors: boolean = false
): PointResolutionContext['projectileTrace'] | undefined => {
    const selectedHex = context.selectedHex;
    if (!selectedHex) return undefined;
    if (mode === 'point_or_wall' && isBlockedByWall(state, selectedHex)) {
        return {
            impactKind: 'wall',
            impactHex: clonePoint(selectedHex),
            line: getHexLine(attacker.position, selectedHex)
        };
    }
    const los = validateLineOfSight(state, attacker.position, selectedHex, {
        stopAtWalls,
        stopAtActors,
        excludeActorId: attacker.id,
        observerActor: attacker
    });
    if (!los.isValid && los.blockedBy === 'wall' && los.blockedAt) {
        return {
            impactKind: 'wall',
            impactHex: clonePoint(los.blockedAt),
            line: getHexLine(attacker.position, los.blockedAt)
        };
    }

    const targetActor = resolveRuntimeSkillTargetActor(state, selectedHex);
    if (mode === 'target_actor' && targetActor) {
        return {
            impactKind: 'actor',
            impactHex: clonePoint(targetActor.position),
            impactActorId: targetActor.id,
            line: getHexLine(attacker.position, targetActor.position)
        };
    }

    if (mode === 'point_or_wall' && targetActor) {
        return {
            impactKind: 'actor',
            impactHex: clonePoint(targetActor.position),
            impactActorId: targetActor.id,
            line: getHexLine(attacker.position, targetActor.position)
        };
    }

    return {
        impactKind: 'empty',
        impactHex: clonePoint(selectedHex),
        line: getHexLine(attacker.position, selectedHex)
    };
};
