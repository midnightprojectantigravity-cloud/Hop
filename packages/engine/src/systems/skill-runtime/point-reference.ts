import type { Actor, GameState, Point } from '../../types';
import { getNeighbors, hexDistance, hexEquals } from '../../hex';
import type { PointResolutionContext } from './point-resolution';
import { resolveDashStopPoint, resolveWithdrawalRetreatPoint } from './path-resolution';
import { validateMovementDestination } from '../capabilities/movement-policy';

export const resolvePointRef = (
    ref: 'origin_hex' | 'caster_hex' | 'selected_hex' | 'impact_hex' | 'anchor_point' | 'scout_orbit_destination' | 'dash_stop_hex' | 'withdrawal_retreat_hex' | 'spear_position' | 'shield_position' | 'target_actor_hex',
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolveRuntimeSkillActorById: (state: GameState, actorId: string) => Actor | undefined
): Point | undefined => {
    const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });
    if (ref === 'origin_hex') return clonePoint(context.initialCasterPosition);
    if (ref === 'caster_hex') return clonePoint(context.actorPositions.get(attacker.id) || attacker.position);
    if (ref === 'selected_hex') return context.selectedHex ? clonePoint(context.selectedHex) : undefined;
    if (ref === 'impact_hex') return context.projectileTrace ? clonePoint(context.projectileTrace.impactHex) : undefined;
    if (ref === 'anchor_point') {
        const behaviorAnchor = attacker.behaviorState?.anchorPoint;
        if (behaviorAnchor) return clonePoint(behaviorAnchor);
        const markTarget = attacker.companionState?.markTarget;
        return markTarget && typeof markTarget === 'object'
            ? clonePoint(markTarget)
            : undefined;
    }
    if (ref === 'scout_orbit_destination') {
        const anchorPoint = resolvePointRef('anchor_point', attacker, state, context, resolveRuntimeSkillActorById);
        if (!anchorPoint) return undefined;
        const currentPosition = context.actorPositions.get(attacker.id) || attacker.position;
        const orbitPositions = getNeighbors(anchorPoint).map(clonePoint);
        if (hexDistance(currentPosition, anchorPoint) !== 1) {
            return orbitPositions.sort((left, right) =>
                hexDistance(currentPosition, left) - hexDistance(currentPosition, right)
            )[0];
        }
        const currentIdx = orbitPositions.findIndex(point => hexEquals(point, currentPosition));
        if (currentIdx === -1) {
            return orbitPositions.sort((left, right) =>
                hexDistance(currentPosition, left) - hexDistance(currentPosition, right)
            )[0];
        }
        return orbitPositions[(currentIdx + 1) % orbitPositions.length];
    }
    if (ref === 'dash_stop_hex') {
        return resolveDashStopPoint(attacker, state, context, (innerRef, innerAttacker, innerState, innerContext) =>
            resolvePointRef(innerRef as any, innerAttacker, innerState, innerContext, resolveRuntimeSkillActorById)
        );
    }
    if (ref === 'withdrawal_retreat_hex') {
        return resolveWithdrawalRetreatPoint(attacker, state, context, (innerRef, innerAttacker, innerState, innerContext) =>
            resolvePointRef(innerRef as any, innerAttacker, innerState, innerContext, resolveRuntimeSkillActorById),
            validateMovementDestination
        );
    }
    if (ref === 'spear_position') return state.spearPosition ? clonePoint(state.spearPosition) : undefined;
    if (ref === 'shield_position') return state.shieldPosition ? clonePoint(state.shieldPosition) : undefined;
    if (!context.targetActorId) return undefined;
    const target = resolveRuntimeSkillActorById(state, context.targetActorId);
    if (!target) return undefined;
    return clonePoint(context.actorPositions.get(target.id) || target.position);
};
