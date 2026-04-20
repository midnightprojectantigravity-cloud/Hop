import type { Actor, GameState, Point } from '../../types';
import { hexAdd, getDirectionFromTo, getHexLine, hexDirection } from '../../hex';
import type { PointResolutionContext } from './point-resolution';
import type { RuntimePointRef, RuntimePathRef } from './types';

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

export const resolvePathRef = (
    pathRef: RuntimePathRef | undefined,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: (
        ref: RuntimePointRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined
): Point[] | undefined => {
    if (!pathRef) return undefined;
    const fromTo = pathRef === 'caster_to_selected'
        ? [resolvePointRef('caster_hex', attacker, state, context), resolvePointRef('selected_hex', attacker, state, context)]
        : pathRef === 'caster_to_impact'
            ? [resolvePointRef('caster_hex', attacker, state, context), resolvePointRef('impact_hex', attacker, state, context)]
            : pathRef === 'caster_to_dash_stop'
                ? [resolvePointRef('caster_hex', attacker, state, context), resolvePointRef('dash_stop_hex', attacker, state, context)]
                : pathRef === 'impact_to_target_actor'
                    ? [resolvePointRef('impact_hex', attacker, state, context), resolvePointRef('target_actor_hex', attacker, state, context)]
                    : pathRef === 'spear_to_caster'
                        ? [resolvePointRef('spear_position', attacker, state, context), resolvePointRef('caster_hex', attacker, state, context)]
                        : [resolvePointRef('shield_position', attacker, state, context), resolvePointRef('caster_hex', attacker, state, context)];

    const [from, to] = fromTo;
    if (!from || !to) return undefined;
    return getHexLine(from, to);
};

export const resolveDirectionFromPath = (
    pathRef: RuntimePathRef | undefined,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: (
        ref: RuntimePointRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined
): Point | undefined => {
    const path = resolvePathRef(pathRef, attacker, state, context, resolvePointRef);
    if (!path || path.length < 2) return undefined;
    const from = path[0]!;
    const to = path[1]!;
    return {
        q: to.q - from.q,
        r: to.r - from.r,
        s: to.s - from.s
    };
};

export const resolvePathPenultimatePoint = (
    pathRef: RuntimePathRef | undefined,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: (
        ref: RuntimePointRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined
): Point | undefined => {
    const path = resolvePathRef(pathRef, attacker, state, context, resolvePointRef);
    if (!path || path.length < 2) return undefined;
    return clonePoint(path[path.length - 2]!);
};

export const resolveDashStopPoint = (
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: (
        ref: RuntimePointRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined
): Point | undefined => {
    const selectedHex = resolvePointRef('selected_hex', attacker, state, context);
    if (!selectedHex) return undefined;
    const trace = context.projectileTrace;
    if (!trace) return clonePoint(selectedHex);
    if (trace.impactKind === 'wall') return undefined;
    if (trace.impactKind === 'empty') return clonePoint(selectedHex);
    if (trace.line.length < 2) return undefined;
    return clonePoint(trace.line[trace.line.length - 2]!);
};

export const resolveWithdrawalRetreatPoint = (
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: (
        ref: RuntimePointRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined,
    validateMovementDestination: (
        state: GameState,
        actor: Actor,
        destination: Point,
        policy: any,
        options: { occupancy: 'none'; excludeActorId: string }
    ) => { isValid: boolean }
): Point | undefined => {
    const targetHex = resolvePointRef('selected_hex', attacker, state, context);
    if (!targetHex) return undefined;
    const directionIndex = getDirectionFromTo(targetHex, attacker.position);
    if (directionIndex === -1) return undefined;
    const retreatVector = hexDirection(directionIndex);
    const withdrawalSkill = attacker.activeSkills?.find(skill => skill.id === 'WITHDRAWAL');
    const maxDistance = withdrawalSkill?.activeUpgrades?.includes('NIMBLE_FEET') ? 3 : 1;
    const policy = {
        ignoreWalls: false,
        movementModel: {
            pathing: 'walk' as const,
            ignoreWalls: false,
            ignoreGroundHazards: false,
            allowPassThroughActors: false,
            rangeModifier: 0
        }
    };

    for (let distance = maxDistance; distance >= 1; distance -= 1) {
        let cursor = clonePoint(attacker.position);
        let valid = true;
        for (let step = 0; step < distance; step += 1) {
            cursor = hexAdd(cursor, retreatVector);
            const validation = validateMovementDestination(state, attacker, cursor, policy, {
                occupancy: 'none',
                excludeActorId: attacker.id
            });
            if (!validation.isValid) {
                valid = false;
                break;
            }
        }
        if (valid) return cursor;
    }

    const alternateDirections = [(directionIndex + 1) % 6, (directionIndex + 5) % 6];
    for (const altDirection of alternateDirections) {
        let cursor = hexAdd(attacker.position, hexDirection(altDirection));
        const validation = validateMovementDestination(state, attacker, cursor, policy, {
            occupancy: 'none',
            excludeActorId: attacker.id
        });
        if (validation.isValid) return cursor;
    }

    return undefined;
};
