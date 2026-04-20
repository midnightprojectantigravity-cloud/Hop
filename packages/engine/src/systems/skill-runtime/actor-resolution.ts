import type { Actor, GameState, Point } from '../../types';
import { pointToKey } from '../../hex';
import { resolveRuntimeSkillActorById } from './targeting';
import type { PointResolutionContext } from './point-resolution';
import type { RuntimeResolvedActorRef } from './types';

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

const resolveOwnerCompanionActor = (
    state: GameState,
    attacker: Actor
): Actor | undefined => {
    const ownerId = attacker.companionOf || attacker.id;
    return [...state.enemies, ...(state.companions || [])].find(candidate => candidate.companionOf === ownerId);
};

const resolveNormalizedFalconFlags = (
    owner: Actor | undefined
): Pick<NonNullable<Actor['companionState']>, 'keenSight' | 'twinTalons' | 'apexPredator'> => {
    const upgrades = owner?.activeSkills?.find(skill => skill.id === 'FALCON_COMMAND')?.activeUpgrades || [];
    return {
        keenSight: upgrades.includes('KEEN_SIGHT'),
        twinTalons: upgrades.includes('TWIN_TALONS') || upgrades.includes('FALCON_TWIN_TALONS'),
        apexPredator: upgrades.includes('APEX_PREDATOR')
    };
};

export const resolveActorRef = (
    ref: RuntimeResolvedActorRef,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext
): Actor | undefined => {
    if (ref === 'self') {
        const position = context.actorPositions.get(attacker.id);
        return position ? { ...attacker, position } : attacker;
    }
    if (ref === 'owner') {
        if (!attacker.companionOf) return undefined;
        const owner = resolveRuntimeSkillActorById(state, attacker.companionOf);
        if (!owner) return undefined;
        const overriddenOwnerPosition = context.actorPositions.get(owner.id);
        return overriddenOwnerPosition ? { ...owner, position: overriddenOwnerPosition } : owner;
    }
    if (ref === 'owner_companion') {
        const companion = resolveOwnerCompanionActor(state, attacker);
        if (!companion) return undefined;
        const overriddenPosition = context.actorPositions.get(companion.id);
        return overriddenPosition ? { ...companion, position: overriddenPosition } : companion;
    }
    if (ref === 'impact_actor') {
        if (!context.projectileTrace?.impactActorId) return undefined;
        const impactActor = resolveRuntimeSkillActorById(state, context.projectileTrace.impactActorId);
        if (!impactActor) return undefined;
        const overriddenImpactPosition = context.actorPositions.get(impactActor.id);
        return overriddenImpactPosition ? { ...impactActor, position: overriddenImpactPosition } : impactActor;
    }
    if (!context.targetActorId) return undefined;
    const target = resolveRuntimeSkillActorById(state, context.targetActorId);
    if (!target) return undefined;
    const overriddenPosition = context.actorPositions.get(target.id);
    return overriddenPosition ? { ...target, position: overriddenPosition } : target;
};

export const createPointProxyTarget = (
    attacker: Actor,
    point: Point
): Actor => ({
    ...attacker,
    id: pointToKey(point),
    position: clonePoint(point),
    hp: 0,
    maxHp: 0
});

export const resolveFalconCompanionState = (
    owner: Actor | undefined,
    initialCompanionState: NonNullable<Actor['companionState']> | undefined
): NonNullable<Actor['companionState']> => {
    const merged = {
        ...(resolveNormalizedFalconFlags(owner) || {}),
        ...(initialCompanionState || {})
    };
    return {
        ...merged,
        mode: merged.mode || 'roost'
    };
};
