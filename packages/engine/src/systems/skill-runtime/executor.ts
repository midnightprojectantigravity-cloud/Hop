import {
    hexAdd,
    getHexLine,
    getNeighbors,
    getDirectionFromTo,
    hexDistance,
    hexDirection,
    hexEquals,
    pointToKey
} from '../../hex';
import type {
    InformationProvider,
    InformationQuery,
    Actor,
    AtomicEffect,
    GameState,
    MovementProvider,
    MovementQuery,
    Point,
    SenseProvider,
    SenseQuery,
    SkillCapabilities,
    SkillDefinition,
    SkillModifier
} from '../../types';
import { getSkillScenarios } from '../../scenarios';
import { addStatus } from '../entities/actor';
import { createRaiseDeadSkeletonId } from '../entities/companion-id-strategies';
import { createCompanion } from '../entities/entity-factory';
import { extractTrinityStats } from '../combat/combat-calculator';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../combat/combat-effect';
import { createBombActor } from '../effects/bomb-runtime';
import { processKineticPulse } from '../movement/kinetic-kernel';
import { consumeRandom } from '../rng';
import { SpatialSystem } from '../spatial-system';
import { buildSkillIntentProfile } from '../skill-intent-profile';
import { resolveSummonPlacement } from '../summon-placement';
import type { CollisionResolutionPolicy } from '../combat/collision-policy';
import { getSurfaceSkillPowerMultiplier, getSurfaceStatus } from '../tiles/surface-status';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { isBlockedByWall, validateLineOfSight } from '../validation';
import { getRuntimeExecutionHandler } from './handler-registry';
import { resolveRuntimeMovementExecutionPlan } from './movement';
import { resolveSkillRuntime } from './resolve';
import {
    evaluateRuntimeSkillPredicate,
    isRuntimeSkillTargetValid,
    resolveRuntimeMovementPolicy,
    resolveRuntimeSkillActorById,
    resolveRuntimeSkillTargetActor,
    resolveRuntimeSkillValidTargets
} from './targeting';
import type {
    EmitJuiceInstruction,
    ResolutionTrace,
    ResolutionTraceEntry,
    ResolutionTraceMode,
    ResolvedSkillRuntime,
    RuntimePointFilter,
    RuntimePointSet,
    RuntimePathRef,
    RuntimePointPattern,
    RuntimeResolvedActorRef,
    RuntimeTargetFanOut,
    RuntimePointRef,
    SkillCollisionPolicy,
    SkillExecutionWithRuntimeResult,
    SkillPhysicsPlan,
    SkillRuntimeDefinition
} from './types';

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

const createTrace = (mode: ResolutionTraceMode): ResolutionTrace => ({
    mode,
    entries: []
});

const appendTrace = (trace: ResolutionTrace, entry: ResolutionTraceEntry): void => {
    if (trace.mode === 'none') return;
    trace.entries.push(entry);
};

type ExecutionContext = {
    initialCasterPosition: Point;
    selectedHex?: Point;
    targetActorId?: string;
    previousNeighbors?: Point[];
    attackerTurnStartPosition?: Point;
    allActorsTurnStartPositions?: Map<string, Point>;
    persistentTargetIds?: string[];
    actorPositions: Map<string, Point>;
    collisionPolicy?: SkillCollisionPolicy;
    physicsPlan: SkillPhysicsPlan;
    trace: ResolutionTrace;
    projectileTrace?: {
        impactKind: 'wall' | 'actor' | 'empty';
        impactHex: Point;
        impactActorId?: string;
        line: Point[];
    };
    rngState: Pick<GameState, 'rngSeed' | 'rngCounter'>;
    rngConsumption: number;
    pointSetCache: Map<string, Point[]>;
};

const syncActorPosition = (
    context: ExecutionContext,
    actorId: string | undefined,
    destination: Point | undefined
): void => {
    if (!actorId || !destination) return;
    context.actorPositions.set(actorId, clonePoint(destination));
};

const resolveActorLabel = (
    actor: Actor,
    state: GameState
): string => actor.id === state.player.id
    ? 'You'
    : `${actor.subtype || 'enemy'}#${actor.id}`;

const consumeRuntimeRandom = (context: ExecutionContext): number => {
    const { value, nextState } = consumeRandom(context.rngState);
    context.rngState = nextState;
    context.rngConsumption += 1;
    return value;
};

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

type ResolvedInstructionPointTarget = {
    point: Point;
    actor?: Actor;
    effectTarget: Point | string;
};

const resolveActorRef = (
    ref: RuntimeResolvedActorRef,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
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

const createPointProxyTarget = (
    attacker: Actor,
    point: Point
): Actor => ({
    ...attacker,
    id: pointToKey(point),
    position: clonePoint(point),
    hp: 0,
    maxHp: 0
});

const resolvePointRef = (
    ref: RuntimePointRef,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): Point | undefined => {
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
        const anchorPoint = resolvePointRef('anchor_point', attacker, state, context);
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
    if (ref === 'spear_position') return state.spearPosition ? clonePoint(state.spearPosition) : undefined;
    if (ref === 'shield_position') return state.shieldPosition ? clonePoint(state.shieldPosition) : undefined;
    if (!context.targetActorId) return undefined;
    const target = resolveRuntimeSkillActorById(state, context.targetActorId);
    if (!target) return undefined;
    return clonePoint(context.actorPositions.get(target.id) || target.position);
};

const resolvePathRef = (
    pathRef: RuntimePathRef | undefined,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): Point[] | undefined => {
    if (!pathRef) return undefined;
    const fromTo = pathRef === 'caster_to_selected'
        ? [resolvePointRef('caster_hex', attacker, state, context), resolvePointRef('selected_hex', attacker, state, context)]
        : pathRef === 'caster_to_impact'
            ? [resolvePointRef('caster_hex', attacker, state, context), resolvePointRef('impact_hex', attacker, state, context)]
            : pathRef === 'impact_to_target_actor'
                ? [resolvePointRef('impact_hex', attacker, state, context), resolvePointRef('target_actor_hex', attacker, state, context)]
                : pathRef === 'spear_to_caster'
                    ? [resolvePointRef('spear_position', attacker, state, context), resolvePointRef('caster_hex', attacker, state, context)]
                    : [resolvePointRef('shield_position', attacker, state, context), resolvePointRef('caster_hex', attacker, state, context)];

    const [from, to] = fromTo;
    if (!from || !to) return undefined;
    return getHexLine(from, to);
};

const resolveDirectionFromPath = (
    pathRef: RuntimePathRef | undefined,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): Point | undefined => {
    const path = resolvePathRef(pathRef, attacker, state, context);
    if (!path || path.length < 2) return undefined;
    const from = path[0]!;
    const to = path[1]!;
    return {
        q: to.q - from.q,
        r: to.r - from.r,
        s: to.s - from.s
    };
};

const resolvePathPenultimatePoint = (
    pathRef: RuntimePathRef | undefined,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): Point | undefined => {
    const path = resolvePathRef(pathRef, attacker, state, context);
    if (!path || path.length < 2) return undefined;
    return clonePoint(path[path.length - 2]!);
};

const resolveJuiceMetadata = (
    metadata: Record<string, unknown> | undefined,
    instruction: EmitJuiceInstruction,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): Record<string, unknown> | undefined => {
    const nextMetadata = metadata ? { ...metadata } : {};

    if (instruction.contactHexRef) {
        const point = resolvePointRef(instruction.contactHexRef, attacker, state, context);
        if (point) nextMetadata.contactHex = point;
    }
    if (instruction.contactToRef) {
        const point = resolvePointRef(instruction.contactToRef, attacker, state, context);
        if (point) nextMetadata.contactToHex = point;
    }
    if (instruction.contactFromRef) {
        const point = resolvePointRef(instruction.contactFromRef, attacker, state, context);
        if (point) nextMetadata.contactFromHex = point;
    }
    if (instruction.contactFromPathRef) {
        const point = resolvePathPenultimatePoint(instruction.contactFromPathRef, attacker, state, context);
        if (point) nextMetadata.contactFromHex = point;
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
};

const resolveInstructionPointPattern = (
    pointPattern: RuntimePointPattern | undefined,
    fanOut: RuntimeTargetFanOut | undefined
): RuntimePointPattern => pointPattern || fanOut || 'selected_hex_only';

const expandSelectedHexPointPattern = (
    selectedHex: Point,
    state: GameState,
    context: ExecutionContext,
    pointPattern: RuntimePointPattern
): Point[] => {
    if (pointPattern === 'selected_neighbors_only') {
        return getNeighbors(selectedHex).map(clonePoint);
    }
    if (pointPattern === 'selected_hex_plus_neighbors') {
        return [clonePoint(selectedHex), ...getNeighbors(selectedHex).map(clonePoint)];
    }
    if (pointPattern === 'selected_hex_only') {
        return [clonePoint(selectedHex)];
    }

    if (pointPattern.kind === 'perpendicular_line') {
        const directionIndex = getDirectionFromTo(context.initialCasterPosition, selectedHex);
        if (directionIndex === -1) return [];

        const sideADirection = (directionIndex + 2) % 6;
        const sideBDirection = (directionIndex + 5) % 6;
        const stepsPerSide = Math.floor(pointPattern.totalLength / 2);
        const points: Point[] = [clonePoint(selectedHex)];

        let sideA = selectedHex;
        for (let step = 0; step < stepsPerSide; step++) {
            sideA = hexAdd(sideA, hexDirection(sideADirection));
            if (SpatialSystem.isWithinBounds(state, sideA)) {
                points.push(clonePoint(sideA));
            }
        }

        let sideB = selectedHex;
        for (let step = 0; step < stepsPerSide; step++) {
            sideB = hexAdd(sideB, hexDirection(sideBDirection));
            if (SpatialSystem.isWithinBounds(state, sideB)) {
                points.push(clonePoint(sideB));
            }
        }

        return points;
    }

    return [clonePoint(selectedHex)];
};

const applyInstructionPointFilters = (
    points: Point[],
    state: GameState,
    pointFilters: RuntimePointFilter[] | undefined
): Point[] => {
    if (!pointFilters || pointFilters.length === 0) return points;

    return points.filter(point => {
        if (pointFilters.includes('skip_blocked_by_wall') && isBlockedByWall(state, point)) {
            return false;
        }
        return true;
    });
};

const resolvePointSet = (
    pointSet: RuntimePointSet | undefined,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext,
    pointFilters?: RuntimePointFilter[]
): Point[] => {
    if (!pointSet) return [];
    if (pointSet.cacheKey && context.pointSetCache.has(pointSet.cacheKey)) {
        return context.pointSetCache.get(pointSet.cacheKey)!.map(clonePoint);
    }

    if (pointSet.kind === 'line_between') {
        const from = resolvePointRef(pointSet.from, attacker, state, context);
        const to = resolvePointRef(pointSet.to, attacker, state, context);
        if (!from || !to) return [];
        let line = getHexLine(from, to);
        if (pointSet.includeStart === false) line = line.slice(1);
        if (pointSet.includeEnd === false) line = line.slice(0, -1);
        const resolved = applyInstructionPointFilters(line.map(clonePoint), state, pointFilters);
        if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, resolved.map(clonePoint));
        return resolved;
    }

    const center = resolvePointRef(pointSet.center, attacker, state, context);
    if (!center) return [];
    const candidates: Point[] = [];
    for (let directionIndex = 0; directionIndex < 6; directionIndex += 1) {
        let cursor = clonePoint(center);
        for (let step = 0; step < pointSet.radius; step += 1) {
            cursor = hexAdd(cursor, hexDirection(directionIndex));
        }
        if (SpatialSystem.isWithinBounds(state, cursor)) {
            candidates.push(clonePoint(cursor));
        }
    }

    const filtered = candidates.filter(candidate =>
        (pointSet.predicates || []).every(predicate =>
            evaluateRuntimeSkillPredicate(
                predicate,
                state,
                resolveActorRef('self', attacker, state, context) || attacker,
                candidate,
                context.trace,
                {
                    selectedHex: context.selectedHex,
                    previousNeighbors: context.previousNeighbors,
                    persistentTargetIds: context.persistentTargetIds,
                    candidateActor: resolveActorAtPoint(state, candidate)
                }
            )
        )
    );

    const ordered = applyInstructionPointFilters(filtered, state, pointFilters);
    if (!pointSet.selection || pointSet.selection.mode === 'all') {
        if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, ordered.map(clonePoint));
        return ordered;
    }

    if (pointSet.selection.mode === 'first_n') {
        const limited = ordered.slice(0, Math.min(pointSet.selection.count ?? ordered.length, ordered.length));
        if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, limited.map(clonePoint));
        return limited;
    }

    const count = Math.min(pointSet.selection.count ?? ordered.length, ordered.length);
    const available = [...ordered];
    const selected: Point[] = [];
    for (let index = 0; index < count; index += 1) {
        if (available.length === 0) break;
        const roll = consumeRuntimeRandom(context);
        const nextIndex = Math.floor(roll * available.length) % available.length;
        selected.push(available[nextIndex]!);
        available.splice(nextIndex, 1);
    }
    if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, selected.map(clonePoint));
    return selected;
};

const resolveInstructionPoints = (
    pointSet: RuntimePointSet | undefined,
    pointPattern: RuntimePointPattern | undefined,
    fanOut: RuntimeTargetFanOut | undefined,
    pointFilters: RuntimePointFilter[] | undefined,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): Point[] => {
    if (pointSet) {
        return resolvePointSet(pointSet, attacker, state, context, pointFilters);
    }
    const selectedHex = resolvePointRef('selected_hex', attacker, state, context);
    if (!selectedHex) return [];
    return applyInstructionPointFilters(
        expandSelectedHexPointPattern(
            selectedHex,
            state,
            context,
            resolveInstructionPointPattern(pointPattern, fanOut)
        ),
        state,
        pointFilters
    );
};

const resolveInstructionPointTargets = (
    targetRef: RuntimeResolvedActorRef | 'selected_hex',
    pointSet: RuntimePointSet | undefined,
    pointPattern: RuntimePointPattern | undefined,
    fanOut: RuntimeTargetFanOut | undefined,
    pointFilters: RuntimePointFilter[] | undefined,
    attacker: Actor,
    state: GameState,
    context: ExecutionContext
): ResolvedInstructionPointTarget[] => {
    if (targetRef === 'selected_hex') {
        const points = resolveInstructionPoints(
            pointSet,
            pointPattern,
            fanOut,
            pointFilters,
            attacker,
            state,
            context
        );
        return points.map(point => ({
            point,
            actor: resolveActorAtPoint(state, point),
            effectTarget: point
        }));
    }

    const actor = resolveActorRef(targetRef, attacker, state, context);
    if (!actor) return [];
    return [{
        point: clonePoint(actor.position),
        actor,
        effectTarget: actor.id
    }];
};

const toCollisionPolicy = (
    instructionPolicy: SkillCollisionPolicy | undefined,
    contextPolicy: SkillCollisionPolicy | undefined,
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

const adjustMagnitudeForWeightClass = (
    baseMagnitude: number,
    actor: Actor | undefined,
    physicsPlan: SkillPhysicsPlan,
    trace: ResolutionTrace,
    path: string
): number => {
    const weightClass = actor?.weightClass;
    if (!weightClass || !physicsPlan.weightClassModifierTable) return baseMagnitude;
    const modifier = Number(physicsPlan.weightClassModifierTable[weightClass] || 0);
    const adjusted = baseMagnitude + modifier;
    if (modifier !== 0) {
        appendTrace(trace, {
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

const resolveRuntimeStatusMultipliers = (
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

const resolveDirectionVector = (
    direction: 'source_to_target' | 'target_to_source',
    attacker: Actor,
    context: ExecutionContext
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

const resolveProjectileTrace = (
    mode: 'point_or_wall' | 'target_actor',
    attacker: Actor,
    state: GameState,
    context: ExecutionContext,
    stopAtWalls: boolean = true,
    stopAtActors: boolean = false
): ExecutionContext['projectileTrace'] | undefined => {
    const selectedHex = resolvePointRef('selected_hex', attacker, state, context);
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

const syncDisplacementEffects = (
    context: ExecutionContext,
    displacementEffects: AtomicEffect[]
): void => {
    for (const effect of displacementEffects) {
        if (effect.type !== 'Displacement') continue;
        if (typeof effect.target !== 'string') continue;
        syncActorPosition(context, effect.target === 'self' ? undefined : effect.target, effect.destination);
    }
};

const createBombActorId = (
    attacker: Actor,
    state: GameState,
    position: Point
): string =>
    `bomb-${attacker.id}-${state.turnNumber}-${state.actionLog?.length ?? 0}-${position.q}_${position.r}_${position.s}`;

const applyInitialStatuses = (
    actor: Actor,
    initialStatuses: Array<{ status: any; duration: number }> | undefined
): Actor => {
    if (!initialStatuses || initialStatuses.length === 0) return actor;
    return initialStatuses.reduce(
        (nextActor, status) => addStatus(nextActor, status.status, status.duration),
        actor
    );
};

const materializeLegacyUpgrades = (definition: SkillRuntimeDefinition): Record<string, SkillModifier> => {
    const upgrades: Record<string, SkillModifier> = {};
    for (const [upgradeId, upgrade] of Object.entries(definition.upgrades || {})) {
        const patches: NonNullable<SkillModifier['patches']> = [];
        for (const patch of upgrade.modifyNumbers || []) {
            if (patch.path === 'baseVariables.range') patches.push({ field: 'range', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.cooldown') patches.push({ field: 'cooldown', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.damage') patches.push({ field: 'damage', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.basePower') patches.push({ field: 'basePower', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.momentum') patches.push({ field: 'momentum', op: patch.op, value: patch.value });
        }
        upgrades[upgradeId] = {
            id: upgrade.id,
            name: upgrade.name,
            description: upgrade.description,
            patches,
            extraEffects: []
        };
    }
    return upgrades;
};

const resolveActorAtPoint = (state: GameState, point: Point): Actor | undefined => {
    if (hexEquals(state.player.position, point)) return state.player;
    const enemy = state.enemies.find(candidate => hexEquals(candidate.position, point));
    if (enemy) return enemy;
    return state.companions?.find(candidate => hexEquals(candidate.position, point));
};

const deriveLegacyCombatProfile = (definition: SkillRuntimeDefinition): SkillDefinition['combat'] | undefined => {
    if (definition.combat) return definition.combat;
    const damageInstruction = definition.combatScript.find(
        instruction => instruction.kind === 'DEAL_DAMAGE'
    );
    if (!damageInstruction || damageInstruction.kind !== 'DEAL_DAMAGE') return undefined;

    const attackProfile =
        definition.targeting.generator === 'axial_ray'
            ? 'projectile'
            : definition.targeting.range > 1
                ? 'projectile'
                : 'melee';

    return {
        damageClass: damageInstruction.damageClass || 'physical',
        damageSubClass: damageInstruction.damageSubClass as any,
        damageElement: damageInstruction.damageElement as any,
        attackProfile,
        trackingSignature: attackProfile === 'projectile' ? 'projectile' : 'melee',
        weights: {}
    };
};

const resolveLegacyPresentationActor = (
    definition: SkillRuntimeDefinition,
    state: GameState
): Actor | undefined => {
    if (state.player?.activeSkills?.some(skill => skill.id === definition.id)) {
        return state.player;
    }
    const enemy = (state.enemies || []).find(candidate =>
        candidate.activeSkills?.some(skill => skill.id === definition.id)
    );
    if (enemy) return enemy;
    return state.companions?.find(candidate =>
        candidate.activeSkills?.some(skill => skill.id === definition.id)
    );
};

const resolveLegacyPresentationRuntime = (
    definition: SkillRuntimeDefinition,
    state: GameState
): ResolvedSkillRuntime => {
    const actor = resolveLegacyPresentationActor(definition, state);
    return resolveSkillRuntime(
        definition,
        actor?.activeSkills.find(skill => skill.id === definition.id)?.activeUpgrades || [],
        'none',
        actor && state.player
            ? {
                state,
                attacker: actor
            }
            : {}
    );
};

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

const getRuntimeSkillUpgradeSet = (actor: Actor, skillId: string): Set<string> => {
    const activeSkill = actor.activeSkills?.find(skill => skill.id === skillId);
    return new Set(activeSkill?.activeUpgrades || []);
};

const computeLegacyStandardVisionRange = (observer: Actor, definition: SkillRuntimeDefinition): number => {
    const provider = definition.capabilities?.senses?.find(candidate => candidate.kind === 'standard_vision_los_v1');
    if (!provider) return 0;
    const trinity = extractTrinityStats(observer);
    const statPool = Math.max(0, trinity.body) + Math.max(0, trinity.mind) + Math.max(0, trinity.instinct);
    const upgrades = getRuntimeSkillUpgradeSet(observer, definition.id);
    const tier = 1
        + (upgrades.has('VISION_TIER_2') ? 1 : 0)
        + (upgrades.has('VISION_TIER_3') ? 1 : 0)
        + (upgrades.has('VISION_TIER_4') ? 1 : 0);
    return clamp(provider.range.base + tier + Math.floor(statPool / 100), provider.range.minimum, provider.range.maximum);
};

const computeLegacyEnemyAwarenessRange = (observer: Actor, definition: SkillRuntimeDefinition): number => {
    const provider = definition.capabilities?.senses?.find(candidate => candidate.kind === 'enemy_awareness_los_v1');
    if (!provider) return 0;
    const trinity = extractTrinityStats(observer);
    const awarenessScore = (0.060 * Math.max(0, trinity.instinct))
        + (0.025 * Math.max(0, trinity.mind))
        + (0.015 * Math.max(0, trinity.body));
    return clamp(provider.range.base + Math.floor(awarenessScore * 1.5), provider.range.minimum, provider.range.maximum);
};

const computeLegacyVibrationSenseRange = (observer: Actor, definition: SkillRuntimeDefinition): number => {
    const provider = definition.capabilities?.senses?.find(candidate => candidate.kind === 'vibration_sense_motion_v1');
    if (!provider) return 0;
    const trinity = extractTrinityStats(observer);
    return clamp(provider.range.base + Math.floor(trinity.instinct / 8), provider.range.minimum, provider.range.maximum);
};

const materializeLegacyCapabilityProviders = (definition: SkillRuntimeDefinition): SkillCapabilities | undefined => {
    const capabilities = definition.capabilities;
    if (!capabilities) return undefined;

    const senses: SenseProvider[] = [];
    const information: InformationProvider[] = [];
    const movement: MovementProvider[] = [];

    for (const provider of capabilities.information || []) {
        information.push({
            domain: 'information',
            providerId: provider.providerId,
            priority: provider.priority,
            resolve: (query: InformationQuery) => {
                switch (provider.kind) {
                    case 'basic_reveal_v1':
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    case 'combat_analysis_v1': {
                        const viewerStats = extractTrinityStats(query.viewer);
                        if (viewerStats.mind < (provider.minViewerStat?.minimum ?? 10)) {
                            return { decision: 'neutral' };
                        }
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    }
                    case 'tactical_insight_v1': {
                        const viewerStats = extractTrinityStats(query.viewer);
                        if (viewerStats.instinct < (provider.minViewerStat?.minimum ?? 10)) {
                            return { decision: 'neutral' };
                        }
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    }
                    case 'oracle_sight_v1':
                        if (!query.context?.topActionUtilities?.length) {
                            return { decision: 'neutral' };
                        }
                        return {
                            decision: 'allow',
                            reveal: { ...provider.reveal }
                        };
                    default:
                        return { decision: 'neutral' };
                }
            }
        });
    }

    for (const provider of capabilities.senses || []) {
        senses.push({
            domain: 'senses',
            providerId: provider.providerId,
            priority: provider.priority,
            resolve: (query: SenseQuery) => {
                switch (provider.kind) {
                    case 'standard_vision_los_v1': {
                        const context = query.context || {};
                        if (context.statusBlind === true || context.smokeBlind === true) {
                            return {
                                decision: 'block',
                                blockKind: 'hard',
                                reason: 'status_blind',
                                channelId: provider.channelId,
                                maxRange: 0
                            };
                        }
                        const range = computeLegacyStandardVisionRange(query.observer, definition);
                        if (query.distance > range) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        const los = query.evaluateLegacyLineOfSight({
                            stopAtWalls: query.stopAtWalls,
                            stopAtActors: query.stopAtActors,
                            stopAtLava: query.stopAtLava,
                            excludeActorId: query.excludeActorId
                        });
                        if (los.isValid) {
                            return {
                                decision: 'allow',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        return {
                            decision: 'block',
                            blockKind: 'soft',
                            reason: 'line_of_sight_blocked',
                            channelId: provider.channelId,
                            maxRange: range
                        };
                    }
                    case 'enemy_awareness_los_v1': {
                        if (query.observer.type !== 'enemy') {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId
                            };
                        }
                        const context = query.context || {};
                        if (context.statusBlind === true || context.smokeBlind === true) {
                            return {
                                decision: 'block',
                                blockKind: 'hard',
                                reason: 'status_blind',
                                channelId: provider.channelId,
                                maxRange: 0
                            };
                        }
                        const range = computeLegacyEnemyAwarenessRange(query.observer, definition);
                        if (query.distance > range) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        const los = query.evaluateLegacyLineOfSight({
                            stopAtWalls: query.stopAtWalls,
                            stopAtActors: query.stopAtActors,
                            stopAtLava: query.stopAtLava,
                            excludeActorId: query.excludeActorId
                        });
                        if (los.isValid) {
                            return {
                                decision: 'allow',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        return {
                            decision: 'block',
                            blockKind: 'soft',
                            reason: 'line_of_sight_blocked',
                            channelId: provider.channelId,
                            maxRange: range
                        };
                    }
                    case 'vibration_sense_motion_v1': {
                        const range = computeLegacyVibrationSenseRange(query.observer, definition);
                        if (query.distance > range) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        const targetActor = query.targetActor;
                        const movedLastTurn = Boolean(
                            targetActor
                            && targetActor.previousPosition
                            && !hexEquals(targetActor.previousPosition, targetActor.position)
                        );
                        if (!movedLastTurn) {
                            return {
                                decision: 'neutral',
                                channelId: provider.channelId,
                                maxRange: range
                            };
                        }
                        return {
                            decision: 'allow',
                            channelId: provider.channelId,
                            maxRange: range
                        };
                    }
                    default:
                        return { decision: 'neutral', channelId: provider.channelId };
                }
            }
        });
    }

    for (const provider of capabilities.movement || []) {
        movement.push({
            domain: 'movement',
            providerId: provider.providerId,
            priority: provider.priority,
            resolutionMode: provider.resolutionMode,
            resolve: (_query: MovementQuery) => {
                switch (provider.kind) {
                    case 'flight_replace_v1':
                    case 'phase_step_replace_v1':
                    case 'burrow_extend_v1':
                    case 'blind_fighting_unseen_penalty_v1':
                        return {
                            decision: 'allow',
                            resolutionMode: provider.resolutionMode,
                            model: { ...provider.model }
                        };
                    default:
                        return {
                            decision: 'neutral',
                            resolutionMode: provider.resolutionMode
                        };
                }
            }
        });
    }

    if (senses.length === 0 && information.length === 0 && movement.length === 0) return undefined;
    return {
        senses,
        information,
        movement
    };
};

const lowerResolvedSkillRuntime = (
    resolved: ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    target?: Point,
    traceMode: ResolutionTraceMode = 'summary',
    runtimeContext: Record<string, any> = {}
): { effects: AtomicEffect[]; messages: string[]; executionTrace: ResolutionTrace; rngConsumption: number } => {
    const executionTrace = createTrace(traceMode);
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    const targetActor = resolveRuntimeSkillTargetActor(state, target);
    const context: ExecutionContext = {
        initialCasterPosition: clonePoint(attacker.position),
        selectedHex: target ? clonePoint(target) : undefined,
        targetActorId: targetActor?.id,
        previousNeighbors: runtimeContext.previousNeighbors,
        attackerTurnStartPosition: runtimeContext.attackerTurnStartPosition,
        allActorsTurnStartPositions: runtimeContext.allActorsTurnStartPositions,
        persistentTargetIds: runtimeContext.persistentTargetIds,
        actorPositions: new Map<string, Point>([[attacker.id, clonePoint(attacker.position)]]),
        collisionPolicy: resolved.physicsPlan.collision,
        physicsPlan: resolved.physicsPlan,
        trace: executionTrace,
        rngState: {
            rngSeed: state.rngSeed,
            rngCounter: state.rngCounter
        },
        rngConsumption: 0,
        pointSetCache: new Map<string, Point[]>()
    };
    if (targetActor) {
        context.actorPositions.set(targetActor.id, clonePoint(targetActor.position));
    }

    for (const instruction of resolved.combatScript) {
        const targetActorRef = resolveActorRef('target_actor', attacker, state, context);
        const conditionAttacker = {
            ...attacker,
            position: clonePoint(context.initialCasterPosition)
        };
        const conditionTargetActor = (
            context.projectileTrace?.impactActorId
                ? resolveRuntimeSkillActorById(state, context.projectileTrace.impactActorId)
                : undefined
        ) || (
            context.targetActorId
                ? resolveRuntimeSkillActorById(state, context.targetActorId)
                : undefined
        ) || resolveRuntimeSkillTargetActor(state, context.selectedHex);
        const conditionPoint = conditionTargetActor?.position
            || context.selectedHex
            || context.initialCasterPosition;
        if (instruction.conditions?.length) {
            const passesConditions = instruction.conditions.every(predicate =>
                evaluateRuntimeSkillPredicate(
                    predicate,
                    state,
                    conditionAttacker,
                    conditionPoint,
                    executionTrace,
                    {
                        targetActor: conditionTargetActor,
                        candidateActor: conditionTargetActor,
                        projectileImpactKind: context.projectileTrace?.impactKind,
                        resolvedKeywords: resolved.resolvedKeywords,
                        previousNeighbors: context.previousNeighbors,
                        persistentTargetIds: context.persistentTargetIds
                    }
                )
            );
            if (!passesConditions) {
                appendTrace(executionTrace, {
                    kind: 'instruction',
                    path: `combatScript.${instruction.id || instruction.kind}.conditions`,
                    message: `Skipped ${instruction.kind} because its runtime conditions failed.`
                });
                continue;
            }
        }

        appendTrace(executionTrace, {
            kind: 'instruction',
            path: `combatScript.${instruction.id || instruction.kind}`,
            message: `Lowering ${instruction.kind}.`,
            metadata: { phase: instruction.phase }
        });

        switch (instruction.kind) {
            case 'MOVE_ACTOR': {
                const actorRef = resolveActorRef(instruction.actor, attacker, state, context);
                const requestedDestination = resolvePointRef(instruction.destination, attacker, state, context);
                if (!actorRef || !requestedDestination) break;

                const movementPlan = (resolved.runtime.movementPolicy
                    && (resolved.targeting.generator === 'movement_reachable' || instruction.simulatePath))
                    ? resolveRuntimeMovementExecutionPlan(resolved.runtime, state, actorRef, requestedDestination)
                    : undefined;
                if (movementPlan && (!movementPlan.path || movementPlan.path.length < 2)) {
                    break;
                }

                if (movementPlan?.interruptionMessage) {
                    messages.push(movementPlan.interruptionMessage);
                }

                const destination = movementPlan?.destination || requestedDestination;
                const source = instruction.suppressPresentation ? undefined : clonePoint(actorRef.position);
                syncActorPosition(context, actorRef.id, destination);
                const suppressPresentation = !!instruction.suppressPresentation;
                effects.push({
                    type: 'Displacement',
                    target: instruction.effectTargetMode === 'actor_id'
                        ? actorRef.id
                        : instruction.actor === 'self'
                            ? 'self'
                            : actorRef.id,
                    destination,
                    source,
                    path: movementPlan?.path || undefined,
                    simulatePath: movementPlan?.movementPolicy.simulatePath ?? instruction.simulatePath,
                    ignoreCollision: instruction.ignoreCollision ?? (movementPlan ? true : undefined),
                    ignoreWalls: instruction.ignoreWalls ?? movementPlan?.movementPolicy.ignoreWalls,
                    ignoreGroundHazards: instruction.ignoreGroundHazards ?? (
                        movementPlan
                            ? (movementPlan.movementPolicy.ignoreGroundHazards
                                || movementPlan.movementPolicy.pathing === 'flight'
                                || movementPlan.movementPolicy.pathing === 'teleport')
                            : undefined
                    ),
                    presentationKind: suppressPresentation
                        ? undefined
                        : instruction.mode === 'LEAP'
                            ? 'jump'
                            : instruction.mode === 'SLIDE'
                                ? 'forced_slide'
                                : 'walk',
                    pathStyle: suppressPresentation
                        ? undefined
                        : instruction.mode === 'LEAP'
                            ? 'arc'
                            : 'hex_step',
                    presentationSequenceId: suppressPresentation
                        ? undefined
                        : movementPlan
                        ? `${actorRef.id}:${resolved.runtime.id}:${destination.q},${destination.r},${destination.s}:${state.turnNumber}`
                        : undefined
                });
                break;
            }
            case 'TRACE_PROJECTILE': {
                context.projectileTrace = resolveProjectileTrace(
                    instruction.mode,
                    attacker,
                    state,
                    context,
                    instruction.stopAtWalls,
                    instruction.stopAtActors
                );
                if (context.projectileTrace?.impactActorId) {
                    context.targetActorId = context.projectileTrace.impactActorId;
                }
                break;
            }
            case 'TELEPORT_ACTOR': {
                const actorRef = resolveActorRef(instruction.actor, attacker, state, context);
                const destination = resolvePointRef(instruction.destination, attacker, state, context);
                if (!actorRef || !destination) break;
                const movementPolicy = resolved.runtime.movementPolicy
                    ? resolveRuntimeMovementPolicy(resolved.runtime, state, actorRef, destination)
                    : undefined;
                const source = clonePoint(actorRef.position);
                syncActorPosition(context, actorRef.id, destination);
                effects.push({
                    type: 'Displacement',
                    target: instruction.actor === 'self' ? 'self' : actorRef.id,
                    destination,
                    source,
                    simulatePath: movementPolicy?.simulatePath,
                    ignoreWalls: instruction.ignoreWalls ?? movementPolicy?.ignoreWalls ?? true,
                    ignoreGroundHazards: instruction.ignoreGroundHazards ?? movementPolicy?.ignoreGroundHazards ?? true,
                    presentationKind: 'teleport',
                    pathStyle: 'blink',
                    presentationSequenceId: `${actorRef.id}:${resolved.runtime.id}:${destination.q},${destination.r},${destination.s}:${state.turnNumber}`
                });
                break;
            }
            case 'APPLY_FORCE': {
                const actorRef = resolveActorRef(instruction.target, attacker, state, context);
                const source = instruction.source
                    ? resolvePointRef(instruction.source, attacker, state, context)
                    : resolvePointRef('caster_hex', attacker, state, context);
                if (!actorRef || !source) break;
                const magnitude = adjustMagnitudeForWeightClass(
                    instruction.magnitude,
                    actorRef,
                    context.physicsPlan,
                    executionTrace,
                    'physicsPlan.weightClassModifierTable'
                );
                effects.push({
                    type: 'ApplyForce',
                    target: actorRef.id,
                    source,
                    mode: instruction.mode,
                    magnitude,
                    maxDistance: instruction.maxDistance,
                    collision: toCollisionPolicy(instruction.collision, context.collisionPolicy, context.physicsPlan) || { onBlocked: 'stop' }
                });
                break;
            }
            case 'EMIT_PULSE': {
                const origin = resolvePointRef(instruction.origin, attacker, state, context);
                const direction = resolveDirectionVector(instruction.direction, attacker, context);
                if (!origin || !direction) break;
                const pulseMagnitude = adjustMagnitudeForWeightClass(
                    instruction.magnitude || context.physicsPlan.baseMomentum || resolved.runtime.baseVariables.momentum || 0,
                    targetActor,
                    context.physicsPlan,
                    executionTrace,
                    'physicsPlan.baseMomentum'
                );
                const pulseEffects = processKineticPulse(state, {
                    origin,
                    direction,
                    momentum: pulseMagnitude,
                    collision: toCollisionPolicy(instruction.collision, context.collisionPolicy, context.physicsPlan)
                });
                effects.push(...pulseEffects);
                syncDisplacementEffects(context, pulseEffects);
                break;
            }
            case 'RESOLVE_COLLISION':
                context.collisionPolicy = instruction.collision;
                break;
            case 'DEAL_DAMAGE': {
                const targets = resolveInstructionPointTargets(
                    instruction.target,
                    instruction.pointSet,
                    instruction.pointPattern,
                    instruction.targetFanOut,
                    instruction.pointFilters,
                    attacker,
                    state,
                    context
                );
                if (targets.length === 0) break;

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
                                ...(instruction.weights ? {
                                    weights: {
                                        ...instruction.weights
                                    }
                                } : {})
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
                                instruction.reason || resolved.runtime.id.toLowerCase()
                            )
                        );
                    }
                    break;
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
                break;
            }
            case 'APPLY_AILMENT': {
                const targets = resolveInstructionPointTargets(
                    instruction.target,
                    instruction.pointSet,
                    instruction.pointPattern,
                    instruction.targetFanOut,
                    instruction.pointFilters,
                    attacker,
                    state,
                    context
                );
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
                break;
            }
            case 'SET_STEALTH': {
                const actorRef = resolveActorRef(instruction.target, attacker, state, context);
                if (!actorRef) break;
                effects.push({
                    type: 'SetStealth',
                    target: actorRef.id === attacker.id ? 'self' : actorRef.id,
                    amount: instruction.amount
                });
                break;
            }
            case 'APPLY_STATUS': {
                const resolvedTargets = resolveInstructionPointTargets(
                    instruction.target,
                    instruction.pointSet,
                    instruction.pointPattern,
                    instruction.targetFanOut,
                    instruction.pointFilters,
                    attacker,
                    state,
                    context
                );
                if (resolvedTargets.length > 0) {
                    for (const resolvedTarget of resolvedTargets) {
                        effects.push({
                            type: 'ApplyStatus',
                            target: resolvedTarget.actor
                                ? resolvedTarget.actor.id
                                : resolvedTarget.point,
                            status: instruction.status,
                            duration: instruction.duration
                        });
                    }
                    if (instruction.message) {
                        messages.push(instruction.message);
                        effects.push({ type: 'Message', text: instruction.message });
                    }
                    break;
                }
                const targetRef = instruction.target === 'selected_hex'
                    ? target
                    : resolveActorRef(instruction.target, attacker, state, context);
                if (!targetRef) break;
                effects.push({
                    type: 'ApplyStatus',
                    target: instruction.target === 'self'
                        ? 'self'
                        : typeof targetRef === 'object' && 'id' in targetRef
                            ? targetRef.id
                            : targetRef,
                    status: instruction.status,
                    duration: instruction.duration
                });
                if (instruction.message) {
                    messages.push(instruction.message);
                    effects.push({ type: 'Message', text: instruction.message });
                }
                break;
            }
            case 'HEAL': {
                const targetRef = instruction.target === 'selected_hex'
                    ? target
                    : resolveActorRef(instruction.target, attacker, state, context);
                if (!targetRef) break;
                effects.push({
                    type: 'Heal',
                    target: instruction.target === 'self'
                        ? 'self'
                        : typeof targetRef === 'object' && 'id' in targetRef
                            ? targetRef.id
                            : 'targetActor',
                    amount: instruction.amount
                });
                break;
            }
            case 'PLACE_SURFACE': {
                const position = resolvePointRef(instruction.target, attacker, state, context);
                const positions = instruction.target === 'selected_hex'
                    ? resolveInstructionPoints(
                        instruction.pointSet,
                        instruction.pointPattern,
                        instruction.targetFanOut,
                        instruction.pointFilters,
                        attacker,
                        state,
                        context
                    )
                    : (position ? [position] : []);
                if (instruction.surface === 'fire') {
                    for (const surfacePoint of positions) {
                        effects.push({ type: 'PlaceFire', position: surfacePoint, duration: instruction.duration });
                    }
                }
                break;
            }
            case 'SPAWN_ACTOR': {
                const owner = resolveActorRef(instruction.owner, attacker, state, context);
                const position = resolvePointRef(instruction.position, attacker, state, context);
                if (!owner) break;
                const spawnPosition = (() => {
                    if (instruction.spawnType === 'companion' && instruction.positionStrategy === 'owner_adjacent_first_valid') {
                        return getNeighbors(owner.position).find(candidate =>
                            SpatialSystem.isWithinBounds(state, candidate)
                            && UnifiedTileService.isWalkable(state, candidate)
                            && !resolveActorAtPoint(state, candidate)
                        );
                    }
                    if (!position) return undefined;
                    if (instruction.spawnType !== 'companion') return position;
                    const placement = resolveSummonPlacement(
                        state,
                        owner,
                        position,
                        instruction.placementPolicy || 'fail'
                    );
                    if (!placement.ok || !placement.spawnPosition) {
                        return undefined;
                    }
                    for (const placementEffect of placement.effects) {
                        effects.push(placementEffect);
                        if (placementEffect.type === 'Displacement' && typeof placementEffect.target === 'string') {
                            syncActorPosition(context, placementEffect.target, placementEffect.destination);
                        }
                    }
                    messages.push(...placement.messages);
                    return placement.spawnPosition;
                })();
                if (!spawnPosition) break;

                const actor = instruction.spawnType === 'ephemeral_actor'
                    ? applyInitialStatuses(
                        createBombActor(
                            instruction.actorId
                                || (instruction.actorIdStrategy === 'bomb_toss_v1'
                                    ? createBombActorId(attacker, state, spawnPosition)
                                    : createBombActorId(attacker, state, spawnPosition)),
                            spawnPosition,
                            (instruction.factionSource
                                ? resolveActorRef(instruction.factionSource, attacker, state, context)
                                : owner
                            )?.factionId || owner.factionId
                        ),
                        instruction.initialStatuses
                    )
                    : createCompanion({
                        companionType: instruction.companionType as any,
                        ownerId: owner.id,
                        ownerFactionId: owner.factionId,
                        position: spawnPosition,
                        id: instruction.actorId
                            || (instruction.actorIdStrategy === 'raise_dead_skeleton_v1'
                                ? createRaiseDeadSkeletonId(state)
                                : instruction.actorIdStrategy === 'falcon_owner_v1'
                                    ? `falcon-${owner.id}`
                                : undefined),
                        summon: instruction.summon,
                        initialAnchorActorId: instruction.anchorActorId,
                        initialAnchorPoint: instruction.anchorPoint,
                        initialBehaviorOverlay: instruction.initialBehaviorOverlay
                    });
                if (instruction.spawnType === 'companion') {
                    const mergedFalconState = {
                        ...(instruction.companionType === 'falcon' ? resolveNormalizedFalconFlags(owner) : {}),
                        ...(instruction.initialCompanionState || {})
                    };
                    actor.companionState = {
                        ...actor.companionState,
                        ...mergedFalconState,
                        mode: mergedFalconState.mode || actor.companionState?.mode || 'roost'
                    };
                }
                syncActorPosition(context, actor.id, actor.position);
                effects.push({ type: 'SpawnActor', actor });
                break;
            }
            case 'SPAWN_ITEM': {
                const position = resolvePointRef(instruction.position, attacker, state, context);
                if (!position) break;
                effects.push({
                    type: 'SpawnItem',
                    itemType: instruction.itemType,
                    position
                });
                break;
            }
            case 'PICKUP_ITEM':
                if (instruction.itemType === 'spear') effects.push({ type: 'PickupSpear', position: instruction.position ? resolvePointRef(instruction.position, attacker, state, context) : undefined });
                if (instruction.itemType === 'shield') effects.push({ type: 'PickupShield', position: instruction.position ? resolvePointRef(instruction.position, attacker, state, context) : undefined });
                break;
            case 'MODIFY_COOLDOWN':
                effects.push({
                    type: 'ModifyCooldown',
                    skillId: instruction.skillId as any,
                    amount: instruction.amount,
                    setExact: instruction.setExact
                });
                break;
            case 'MODIFY_RESOURCE': {
                const actorRef = resolveActorRef(instruction.target, attacker, state, context);
                if (!actorRef) break;
                effects.push({
                    type: 'ApplyResources',
                    target: actorRef.id,
                    sparkDelta: instruction.sparkDelta,
                    manaDelta: instruction.manaDelta,
                    exhaustionDelta: instruction.exhaustionDelta,
                    actionCountDelta: instruction.actionCountDelta
                });
                break;
            }
            case 'REMOVE_CORPSE': {
                const position = resolvePointRef(instruction.position, attacker, state, context);
                if (!position) break;
                effects.push({ type: 'RemoveCorpse', position });
                break;
            }
            case 'PLACE_TRAP': {
                const owner = resolveActorRef(instruction.owner, attacker, state, context);
                if (!owner) break;
                const positions = instruction.pointSet
                    ? resolvePointSet(instruction.pointSet, attacker, state, context)
                    : (instruction.position ? [resolvePointRef(instruction.position, attacker, state, context)].filter((point): point is Point => !!point) : []);
                for (const position of positions) {
                    effects.push({
                        type: 'PlaceTrap',
                        position,
                        ownerId: owner.id,
                        volatileCore: instruction.volatileCore,
                        chainReaction: instruction.chainReaction,
                        resetCooldown: instruction.resetCooldown
                    });
                }
                break;
            }
            case 'REMOVE_TRAP': {
                const position = resolvePointRef(instruction.position, attacker, state, context);
                if (!position) break;
                effects.push({
                    type: 'RemoveTrap',
                    position,
                    ownerId: instruction.owner
                        ? resolveActorRef(instruction.owner, attacker, state, context)?.id
                        : undefined
                });
                break;
            }
            case 'SET_TRAP_COOLDOWN': {
                const position = resolvePointRef(instruction.position, attacker, state, context);
                if (!position) break;
                effects.push({
                    type: 'SetTrapCooldown',
                    position,
                    cooldown: instruction.cooldown,
                    ownerId: instruction.owner
                        ? resolveActorRef(instruction.owner, attacker, state, context)?.id
                        : undefined
                });
                break;
            }
            case 'UPDATE_COMPANION_STATE': {
                const actorRef = resolveActorRef(instruction.target, attacker, state, context);
                if (!actorRef) break;
                effects.push({
                    type: 'UpdateCompanionState',
                    target: actorRef.id,
                    mode: instruction.mode,
                    markTarget: instruction.markTarget === 'selected_hex'
                        ? resolvePointRef('selected_hex', attacker, state, context)
                        : instruction.markTarget === 'target_actor_id'
                            ? context.targetActorId || null
                        : instruction.markTarget,
                    orbitStep: instruction.orbitStep,
                    apexStrikeCooldown: instruction.apexStrikeCooldown,
                    healCooldown: instruction.healCooldown,
                    keenSight: instruction.keenSight,
                    twinTalons: instruction.twinTalons,
                    apexPredator: instruction.apexPredator
                });
                break;
            }
            case 'UPDATE_BEHAVIOR_STATE': {
                const actorRef = resolveActorRef(instruction.target, attacker, state, context);
                if (!actorRef) break;
                const anchorPoint = typeof instruction.anchorPoint === 'string'
                    ? resolvePointRef(instruction.anchorPoint, attacker, state, context)
                    : instruction.anchorPoint;
                const anchorActorId = instruction.anchorActorRef === null
                    ? null
                    : instruction.anchorActorRef
                        ? resolveActorRef(instruction.anchorActorRef, attacker, state, context)?.id
                        : instruction.anchorActorId;
                effects.push({
                    type: 'UpdateBehaviorState',
                    target: actorRef.id,
                    overlays: instruction.overlays,
                    anchorActorId,
                    anchorPoint,
                    goal: instruction.goal,
                    controller: instruction.controller,
                    clearOverlays: instruction.clearOverlays
                });
                break;
            }
            case 'EMIT_JUICE': {
                const pointTargets = instruction.pointSet
                    ? resolvePointSet(instruction.pointSet, attacker, state, context)
                    : [];
                const actorTarget = instruction.targetActor
                    ? resolveActorRef(instruction.targetActor, attacker, state, context)
                    : undefined;
                const juiceTargets = pointTargets.length > 0
                    ? pointTargets
                    : [instruction.target ? resolvePointRef(instruction.target, attacker, state, context) : undefined]
                        .filter((value): value is Point => !!value);
                const path = resolvePathRef(instruction.pathRef, attacker, state, context);
                const direction = instruction.direction
                    || (instruction.directionRef
                        ? resolvePointRef(instruction.directionRef, attacker, state, context)
                        : resolveDirectionFromPath(instruction.directionPathRef, attacker, state, context));
                const metadata = resolveJuiceMetadata(
                    instruction.metadata as Record<string, unknown> | undefined,
                    instruction,
                    attacker,
                    state,
                    context
                );

                const targets = juiceTargets.length > 0
                    ? juiceTargets
                    : [actorTarget?.id];
                for (const juiceTarget of targets) {
                    effects.push({
                        type: 'Juice',
                        effect: instruction.effect,
                        target: juiceTarget,
                        path,
                        intensity: instruction.intensity,
                        direction,
                        text: instruction.text,
                        duration: instruction.duration,
                        color: instruction.color,
                        metadata: metadata as Record<string, any> | undefined
                    });
                }
                break;
            }
            case 'MESSAGE': {
                const messageText = instruction.format === 'movement_summary'
                    ? (() => {
                        const messageActor = resolveActorRef(instruction.actor || 'self', attacker, state, context);
                        if (!messageActor) return instruction.text;
                        const resolvedRange = instruction.includeResolvedRange
                            ? resolveRuntimeMovementPolicy(resolved.runtime, state, messageActor, context.selectedHex)?.range
                            : undefined;
                        const suffix = resolvedRange !== undefined ? ` [Range ${resolvedRange}]` : '';
                        return `${resolveActorLabel(messageActor, state)} moved to (${messageActor.position.q}, ${messageActor.position.r}).${suffix}`;
                    })()
                    : instruction.format === 'attack_summary'
                        ? ''
                    : instruction.text;
                if (instruction.format === 'attack_summary') {
                    const messageActor = resolveActorRef(instruction.actor || 'self', attacker, state, context);
                    if (!messageActor) break;
                    const messageTargets = resolveInstructionPointTargets(
                        instruction.targetActor || 'target_actor',
                        instruction.pointSet,
                        instruction.pointPattern,
                        instruction.targetFanOut,
                        instruction.pointFilters,
                        attacker,
                        state,
                        context
                    );
                    const actionVerb = instruction.actionVerb || 'attacked';
                    for (const messageTarget of messageTargets) {
                        const targetActor = messageTarget.actor
                            || (typeof messageTarget.effectTarget === 'string'
                                ? resolveRuntimeSkillActorById(state, messageTarget.effectTarget)
                                : undefined);
                        if (!targetActor) continue;
                        const message = `${resolveActorLabel(messageActor, state)} ${actionVerb} ${resolveActorLabel(targetActor, state).toLowerCase()}!`;
                        messages.push(message);
                        effects.push({ type: 'Message', text: message });
                    }
                    break;
                }
                messages.push(messageText);
                effects.push({ type: 'Message', text: messageText });
                break;
            }
        }
    }

    return {
        effects,
        messages,
        executionTrace,
        rngConsumption: context.rngConsumption
    };
};

export const resolveAndExecuteSkillRuntime = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    target?: Point,
    activeUpgradeIds: string[] = [],
    traceMode: ResolutionTraceMode = 'summary',
    runtimeContext: Record<string, any> = {}
): SkillExecutionWithRuntimeResult => {
    const resolved = resolveSkillRuntime(definition, activeUpgradeIds, traceMode, { state, attacker });
    if (definition.preconditions?.some(precondition => precondition.kind === 'stunned')) {
        const stunnedThisStep = (state.timelineEvents || []).some(ev =>
            ev.phase === 'STATUS_APPLY'
            && ev.type === 'ApplyStatus'
            && ev.payload?.status === 'stunned'
            && (
                ev.payload?.target === attacker.id
                || (
                    typeof ev.payload?.target === 'object'
                    && ev.payload?.target
                    && hexEquals(ev.payload.target as Point, attacker.position)
                )
            )
        );
        const isStunnedNow = attacker.statusEffects?.some(status => status.type === 'stunned') || stunnedThisStep;
        if (isStunnedNow) {
            const precondition = definition.preconditions.find(candidate => candidate.kind === 'stunned')!;
            return {
                effects: [],
                messages: precondition.message ? [precondition.message] : [],
                consumesTurn: precondition.consumesTurn,
                rngConsumption: 0,
                resolvedRuntime: resolved,
                executionTrace: createTrace(traceMode)
            };
        }
    }
    if (resolved.combatScript.length === 0) {
        return {
            effects: [],
            messages: [],
            consumesTurn: false,
            rngConsumption: 0,
            resolvedRuntime: resolved,
            executionTrace: createTrace(traceMode)
        };
    }
    const targetToUse = target || (resolved.targeting.generator === 'self' ? attacker.position : undefined);
    const targetingTrace = createTrace(traceMode);
    const validTargets = resolveRuntimeSkillValidTargets(resolved, state, attacker, targetingTrace);
    if (!targetToUse) {
        return {
            effects: [],
            messages: [definition.validationMessages?.missingTarget || 'A target is required.'],
            consumesTurn: false,
            rngConsumption: 0,
            resolvedRuntime: resolved,
            executionTrace: targetingTrace
        };
    }

    const isValid = validTargets.some(candidate => hexEquals(candidate, targetToUse))
        || (resolved.targeting.generator === 'self' && hexEquals(targetToUse, attacker.position))
        || isRuntimeSkillTargetValid(resolved, state, attacker, targetToUse, targetingTrace);
    if (!isValid) {
        const targetActor = resolveRuntimeSkillTargetActor(state, targetToUse);
        const validationMessage = hexDistance(attacker.position, targetToUse) > resolved.targeting.range
            ? definition.validationMessages?.outOfRange
            : !targetActor || targetActor.id === attacker.id
                ? definition.validationMessages?.noTargetActor
                : targetActor.factionId === attacker.factionId
                    ? definition.validationMessages?.friendlyTarget
                    : definition.validationMessages?.invalidTarget;
        return {
            effects: [],
            messages: [validationMessage || 'Invalid target.'],
            consumesTurn: false,
            rngConsumption: 0,
            resolvedRuntime: resolved,
            executionTrace: targetingTrace
        };
    }

    const executionHandler = getRuntimeExecutionHandler(definition.handlerRefs?.execution);
    if (executionHandler) {
        return executionHandler({
            definition,
            resolved,
            state,
            attacker,
            target: targetToUse
        });
    }

    const lowered = lowerResolvedSkillRuntime(resolved, state, attacker, targetToUse, traceMode, runtimeContext);
    return {
        effects: lowered.effects,
        messages: lowered.messages,
        consumesTurn: true,
        rngConsumption: lowered.rngConsumption,
        resolvedRuntime: resolved,
        executionTrace: lowered.executionTrace
    };
};

export const materializeLegacySkillDefinition = (
    definition: SkillRuntimeDefinition
): SkillDefinition => {
    const dynamicPresentation = !!definition.presentationVariants?.length;
    const legacy: SkillDefinition = {
        id: definition.id as any,
        name: dynamicPresentation
            ? ((state: GameState) => resolveLegacyPresentationRuntime(definition, state).runtime.name)
            : definition.name,
        description: dynamicPresentation
            ? ((state: GameState) => resolveLegacyPresentationRuntime(definition, state).runtime.description)
            : definition.description,
        slot: definition.slot,
        icon: definition.icon,
        baseVariables: { ...definition.baseVariables },
        combat: deriveLegacyCombatProfile(definition),
        capabilities: materializeLegacyCapabilityProviders(definition),
        execute: (state, attacker, target, activeUpgrades = [], context = {}) => {
            const traceMode = (context.traceMode as ResolutionTraceMode | undefined) || 'summary';
            const execution = resolveAndExecuteSkillRuntime(definition, state, attacker, target, activeUpgrades, traceMode, context);
            return {
                effects: execution.effects,
                messages: execution.messages,
                consumesTurn: execution.consumesTurn,
                rngConsumption: execution.rngConsumption
            };
        },
        getValidTargets: (state, origin) => {
            const actor = resolveActorAtPoint(state, origin);
            if (!actor) return [];
            const activeUpgradeIds = actor.activeSkills.find(skill => skill.id === definition.id)?.activeUpgrades || [];
            const resolved = resolveSkillRuntime(definition, activeUpgradeIds, 'none', { state, attacker: actor });
            return resolveRuntimeSkillValidTargets(resolved, state, actor, createTrace('none'));
        },
        resourceProfile: definition.resourceProfile,
        metabolicBandProfile: definition.metabolicBandProfile,
        intentProfile: definition.intentProfile,
        summon: definition.summon,
        deathDecalVariant: definition.deathDecalVariant,
        scenarios: getSkillScenarios(definition.id),
        upgrades: materializeLegacyUpgrades(definition)
    };
    legacy.intentProfile = legacy.intentProfile || buildSkillIntentProfile(legacy);
    return legacy;
};
