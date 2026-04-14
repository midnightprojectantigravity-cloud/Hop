import { getActorAt as getBaseActorAt } from '../../helpers';
import {
    createHex,
    getGridForShape,
    getNeighbors,
    hexDistance,
    hexEquals,
    pointToKey
} from '../../hex';
import type {
    Actor,
    GameState,
    Point,
    WeightClass
} from '../../types';
import { validateLineOfSight } from '../validation';
import type { TileTrait } from '../tiles/tile-types';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { SpatialSystem } from '../spatial-system';
import { validateMovementDestination } from '../capabilities/movement-policy';
import { resolveSummonPlacement } from '../summon-placement';
import { getRuntimeTargetingHandler } from './handler-registry';
import {
    resolveRuntimeMovementPolicy as resolveSharedRuntimeMovementPolicy,
    resolveRuntimeReachableMovementTargets
} from './movement';
import type {
    ResolutionTrace,
    ResolutionTraceEntry,
    ResolvedSkillRuntime,
    ResolvedTargetingDefinition,
    SkillRuntimeDefinition,
    SkillTargetPredicate
} from './types';

const resolveActorAt = (state: GameState, position: Point): Actor | undefined => {
    const actor = getBaseActorAt(state, position) as Actor | undefined;
    if (actor) return actor;
    return state.companions?.find(companion =>
        companion.position.q === position.q
        && companion.position.r === position.r
        && companion.position.s === position.s
    );
};

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(enemy => enemy.id === actorId) || state.companions?.find(companion => companion.id === actorId);
};

const sortTargets = (origin: Point, targets: Point[], mode: ResolvedTargetingDefinition['deterministicSort']): Point[] => {
    return [...targets].sort((left, right) => {
        if (mode === 'q_then_r') return left.q === right.q ? left.r - right.r : left.q - right.q;
        if (mode === 'r_then_q') return left.r === right.r ? left.q - right.q : left.r - right.r;
        const distanceDelta = hexDistance(origin, left) - hexDistance(origin, right);
        if (distanceDelta !== 0) return distanceDelta;
        return left.q === right.q ? left.r - right.r : left.q - right.q;
    });
};

const isAxialAlignment = (origin: Point, candidate: Point, axis: 'Q' | 'R' | 'S' | 'ANY'): boolean => {
    if (axis === 'ANY') {
        return origin.q === candidate.q || origin.r === candidate.r || origin.s === candidate.s;
    }
    if (axis === 'Q') return origin.q === candidate.q;
    if (axis === 'R') return origin.r === candidate.r;
    return origin.s === candidate.s;
};

const resolveWeightClass = (actor: Actor | undefined): WeightClass | undefined =>
    actor?.weightClass;

const compareNumeric = (op: 'eq' | 'lte' | 'gte', actual: number, expected: number): boolean => {
    if (op === 'eq') return actual === expected;
    if (op === 'lte') return actual <= expected;
    return actual >= expected;
};

const compareBoolean = (actual: boolean, expected = true): boolean => actual === expected;

const appendTrace = (trace: ResolutionTrace, entry: ResolutionTraceEntry): void => {
    if (trace.mode === 'none') return;
    if (trace.mode === 'summary' && (entry.kind === 'target' || entry.kind === 'predicate')) return;
    trace.entries.push(entry);
};

type RuntimePredicateEvaluationOptions = {
    candidateActor?: Actor;
    targetActor?: Actor;
    projectileImpactKind?: 'wall' | 'actor' | 'empty';
    resolvedKeywords?: string[];
    selectedHex?: Point;
    previousNeighbors?: Point[];
    persistentTargetIds?: string[];
};

const resolveStatusDuration = (
    actor: Actor | undefined,
    statusId: string
): number | undefined =>
    actor?.statusEffects?.find(status => status.type === statusId)?.duration;

const resolveOwnerActor = (
    state: GameState,
    attacker: Actor
): Actor | undefined => attacker.companionOf
    ? resolveActorById(state, attacker.companionOf)
    : attacker;

const resolveOwnedCompanion = (
    state: GameState,
    attacker: Actor,
    subtype?: string
): Actor | undefined => {
    const owner = resolveOwnerActor(state, attacker);
    if (!owner) return undefined;
    return [...state.enemies, ...(state.companions || [])].find(candidate =>
        candidate.companionOf === owner.id
        && (!subtype || candidate.subtype === subtype)
    );
};

const resolveAnchorPoint = (attacker: Actor): Point | undefined => {
    const behaviorAnchor = attacker.behaviorState?.anchorPoint;
    if (behaviorAnchor) return behaviorAnchor;
    const markTarget = attacker.companionState?.markTarget;
    return markTarget && typeof markTarget === 'object'
        ? markTarget
        : undefined;
};

const resolveScoutOrbitDestinationCandidate = (
    state: GameState,
    attacker: Actor,
    anchorPoint: Point
): Point | undefined => {
    const orbitPositions = getNeighbors(anchorPoint);
    if (hexDistance(attacker.position, anchorPoint) !== 1) {
        return [...orbitPositions]
            .filter(point => SpatialSystem.isWithinBounds(state, point))
            .sort((left, right) => hexDistance(attacker.position, left) - hexDistance(attacker.position, right))[0];
    }
    const currentIdx = orbitPositions.findIndex(point => hexEquals(point, attacker.position));
    if (currentIdx === -1) {
        return [...orbitPositions]
            .filter(point => SpatialSystem.isWithinBounds(state, point))
            .sort((left, right) => hexDistance(attacker.position, left) - hexDistance(attacker.position, right))[0];
    }
    const nextPoint = orbitPositions[(currentIdx + 1) % orbitPositions.length];
    return SpatialSystem.isWithinBounds(state, nextPoint) ? nextPoint : undefined;
};

export const evaluateRuntimeSkillPredicate = (
    predicate: SkillTargetPredicate,
    state: GameState,
    attacker: Actor,
    candidate: Point,
    trace: ResolutionTrace,
    options: RuntimePredicateEvaluationOptions = {}
): boolean => {
    const candidateActor = options.candidateActor || resolveActorAt(state, candidate);
    const targetActor = options.targetActor || candidateActor;
    switch (predicate.type) {
        case 'ALL':
            return predicate.predicates.every(inner => evaluateRuntimeSkillPredicate(inner, state, attacker, candidate, trace, options));
        case 'ANY':
            return predicate.predicates.some(inner => evaluateRuntimeSkillPredicate(inner, state, attacker, candidate, trace, options));
        case 'NOT':
            return !evaluateRuntimeSkillPredicate(predicate.predicate, state, attacker, candidate, trace, options);
        case 'WORLD_STATE': {
            const actual = predicate.key === 'has_spear'
                ? !!state.hasSpear
                : predicate.key === 'has_shield'
                    ? !!state.hasShield
                    : predicate.key === 'spear_position_present'
                        ? !!state.spearPosition
                        : !!state.shieldPosition;
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'PROJECTILE_IMPACT':
            return compareBoolean(options.projectileImpactKind === predicate.kind, predicate.value ?? true);
        case 'RESOLVED_KEYWORD':
            return compareBoolean((options.resolvedKeywords || []).includes(predicate.keyword), predicate.value ?? true);
        case 'HEX_TRAIT': {
            const traits = UnifiedTileService.getTraitsAt(state, candidate);
            return compareBoolean(traits.has(predicate.trait as TileTrait), predicate.value ?? true);
        }
        case 'TILE_EFFECT': {
            const tile = UnifiedTileService.getTileAt(state, candidate);
            const hasEffect = tile.effects.some(effect => effect.id === predicate.effectId);
            return compareBoolean(hasEffect, predicate.value ?? true);
        }
        case 'OCCUPANCY':
            return compareBoolean(!!candidateActor, predicate.occupied);
        case 'CORPSE_PRESENT': {
            const traits = UnifiedTileService.getTraitsAt(state, candidate);
            return compareBoolean(traits.has('CORPSE'), predicate.value ?? true);
        }
        case 'AXIAL_ALIGNMENT':
            return compareBoolean(isAxialAlignment(attacker.position, candidate, predicate.axis), predicate.value ?? true);
        case 'DISTANCE': {
            const fromPoint = predicate.from === 'previous_position'
                ? (attacker.previousPosition || attacker.position)
                : predicate.from === 'selected_hex'
                    ? (options.selectedHex || attacker.position)
                    : attacker.position;
            return compareNumeric(predicate.op, hexDistance(fromPoint, candidate), predicate.value);
        }
        case 'LINE_OF_SIGHT': {
            const los = validateLineOfSight(state, attacker.position, candidate, { observerActor: attacker }).isValid;
            return compareBoolean(los, predicate.value);
        }
        case 'STATUS': {
            const subject = predicate.target === 'caster' ? attacker : targetActor;
            const hasStatus = !!subject?.statusEffects?.some(status => status.type === predicate.statusId);
            return compareBoolean(hasStatus, predicate.value ?? true);
        }
        case 'STATUS_DURATION': {
            const subject = predicate.target === 'caster' ? attacker : targetActor;
            const duration = resolveStatusDuration(subject, predicate.statusId);
            if (duration === undefined) return false;
            return compareNumeric(predicate.op, duration, predicate.value);
        }
        case 'RESOURCE': {
            const subject = predicate.target === 'caster' ? attacker : targetActor;
            if (!subject) return false;
            const value = predicate.resource === 'hp'
                ? Number(subject.hp || 0)
                : predicate.resource === 'spark'
                    ? Number(subject.ires?.spark || 0)
                    : predicate.resource === 'mana'
                        ? Number(subject.ires?.mana || 0)
                        : Number(subject.ires?.exhaustion || 0);
            return compareNumeric(predicate.op, value, predicate.value);
        }
        case 'TURN_STATE': {
            if (predicate.kind === 'held_position') {
                const held = !!attacker.previousPosition
                    && pointToKey(attacker.previousPosition) === pointToKey(attacker.position);
                return compareBoolean(held, predicate.value === undefined ? true : Boolean(predicate.value));
            }
            const movedDistance = attacker.previousPosition
                ? hexDistance(attacker.previousPosition, attacker.position)
                : 0;
            return compareNumeric(predicate.op || 'eq', movedDistance, Number(predicate.value || 0));
        }
        case 'WEIGHT_CLASS': {
            const subject = predicate.target === 'caster' ? attacker : targetActor;
            const actual = resolveWeightClass(subject);
            if (!actual) return false;
            if (predicate.op === 'eq') return actual === predicate.value;
            if (predicate.op === 'neq') return actual !== predicate.value;
            return (predicate.values || []).includes(actual);
        }
        case 'FACTION_RELATION': {
            if (!candidateActor) return false;
            const isSelf = candidateActor.id === attacker.id;
            const isAlly = !isSelf && candidateActor.factionId === attacker.factionId;
            const isEnemy = !isSelf && candidateActor.factionId !== attacker.factionId;
            const actual = predicate.relation === 'self'
                ? isSelf
                : predicate.relation === 'ally'
                    ? isAlly
                    : isEnemy;
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'HAS_SKILL': {
            const subject = predicate.target === 'caster' ? attacker : targetActor;
            const actual = !!subject?.activeSkills?.some(skill => skill.id === predicate.skillId);
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'ACTOR_TYPE': {
            const subject = predicate.target === 'caster' ? attacker : targetActor;
            if (!subject) return false;
            const actual = predicate.actorType === 'player'
                ? subject.id === state.player.id
                : predicate.actorType === 'companion'
                    ? !!subject.companionOf
                    : subject.id !== state.player.id && !subject.companionOf;
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'TURN_START_ADJACENT': {
            const persistentTargetIds = options.persistentTargetIds || [];
            const previousNeighbors = options.previousNeighbors || [];
            const actorAtCandidate = candidateActor || getBaseActorAt(state, candidate);
            const actual = persistentTargetIds.length > 0
                ? !!actorAtCandidate && persistentTargetIds.includes(actorAtCandidate.id)
                : previousNeighbors.some(point => pointToKey(point) === pointToKey(candidate));
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'PERSISTENT_TARGET_AVAILABLE': {
            const persistentTargetIds = options.persistentTargetIds || [];
            const previousNeighbors = options.previousNeighbors || [];
            const actual = getNeighbors(attacker.position).some(point => {
                const actorAtPoint = getBaseActorAt(state, point);
                if (!actorAtPoint || actorAtPoint.hp <= 0 || actorAtPoint.id === attacker.id) return false;
                if (attacker.factionId === actorAtPoint.factionId) return false;
                return persistentTargetIds.length > 0
                    ? persistentTargetIds.includes(actorAtPoint.id)
                    : previousNeighbors.some(previous => pointToKey(previous) === pointToKey(point));
            });
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'COMPANION_PRESENT': {
            const owner = predicate.owner === 'owner'
                ? resolveOwnerActor(state, attacker)
                : attacker;
            const companion = owner
                ? [...state.enemies, ...(state.companions || [])].find(candidate =>
                    candidate.companionOf === owner.id
                    && (!predicate.subtype || candidate.subtype === predicate.subtype)
                )
                : undefined;
            return compareBoolean(!!companion, predicate.value ?? true);
        }
        case 'COMPANION_MODE': {
            const subject = predicate.target === 'caster'
                ? attacker
                : resolveOwnedCompanion(state, attacker, predicate.subtype);
            return compareBoolean(subject?.companionState?.mode === predicate.mode, predicate.value ?? true);
        }
        case 'COMPANION_FLAG': {
            const subject = predicate.target === 'caster'
                ? attacker
                : resolveOwnedCompanion(state, attacker, predicate.subtype);
            const actual = predicate.flag === 'keenSight'
                ? !!subject?.companionState?.keenSight
                : predicate.flag === 'twinTalons'
                    ? !!subject?.companionState?.twinTalons
                    : !!subject?.companionState?.apexPredator;
            return compareBoolean(actual, predicate.value ?? true);
        }
        case 'COMPANION_STATE_NUMBER': {
            const subject = predicate.target === 'caster'
                ? attacker
                : resolveOwnedCompanion(state, attacker, predicate.subtype);
            const actual = Number(subject?.companionState?.[predicate.field] ?? Number.NaN);
            if (!Number.isFinite(actual)) return false;
            return compareNumeric(predicate.op, actual, predicate.value);
        }
        case 'STEALTH_COUNTER': {
            const subject = predicate.target === 'caster'
                ? attacker
                : targetActor;
            const actual = Number(subject?.stealthCounter ?? 0);
            return compareNumeric(predicate.op, actual, predicate.value);
        }
    }
};

export const resolveRuntimeMovementPolicy = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    target?: Point
) => resolveSharedRuntimeMovementPolicy(definition, state, attacker, target);

const validateRuntimeMovementTarget = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    candidate: Point
): boolean => {
    const movementPolicy = definition.movementPolicy;
    if (!movementPolicy) return true;
    const resolvedMovementPolicy = resolveRuntimeMovementPolicy(definition, state, attacker, candidate);
    if (!resolvedMovementPolicy) return true;

    if (hexDistance(attacker.position, candidate) > resolvedMovementPolicy.range) {
        return false;
    }

    if (!movementPolicy.validateDestination) return true;

    return validateMovementDestination(
        state,
        attacker,
        candidate,
        resolvedMovementPolicy,
        movementPolicy.validateDestination
    ).isValid;
};

const validateRuntimeCompanionSpawnTarget = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    candidate: Point
): boolean => {
    for (const instruction of definition.combatScript) {
        if (instruction.kind !== 'SPAWN_ACTOR') continue;
        if (instruction.spawnType !== 'companion') continue;
        if (instruction.position !== 'selected_hex') continue;
        if (instruction.positionStrategy === 'owner_adjacent_first_valid') continue;

        const owner = instruction.owner === 'self'
            ? attacker
            : resolveActorAt(state, candidate);
        if (!owner) return false;

        const placement = resolveSummonPlacement(
            state,
            owner,
            candidate,
            instruction.placementPolicy || 'fail'
        );
        if (!placement.ok) return false;
    }

    return true;
};

const validateAnchorPointMoveTarget = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    candidate: Point
): boolean => {
    const orbitMoveInstruction = definition.combatScript.find(instruction =>
        (instruction.kind === 'MOVE_ACTOR' || instruction.kind === 'TELEPORT_ACTOR')
        && instruction.destination === 'scout_orbit_destination'
    );
    if (!orbitMoveInstruction) return true;
    const destination = resolveScoutOrbitDestinationCandidate(state, attacker, candidate);
    if (!destination) return false;
    if (!SpatialSystem.isWithinBounds(state, destination)) return false;
    if (!UnifiedTileService.isWalkable(state, destination)) return false;
    return !resolveActorAt(state, destination);
};

export const resolveRuntimeSkillValidTargets = (
    definition: SkillRuntimeDefinition | ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    trace: ResolutionTrace
): Point[] => {
    const runtimeDefinition = 'runtime' in definition ? definition.runtime : definition;
    const handler = getRuntimeTargetingHandler(runtimeDefinition.handlerRefs?.targeting);
    if (handler) {
        const handled = handler({ definition: runtimeDefinition, state, attacker });
        appendTrace(trace, {
            kind: 'handler',
            path: 'targeting',
            message: `Targeting handler "${runtimeDefinition.handlerRefs?.targeting}" resolved ${handled.length} targets.`,
            metadata: { count: handled.length }
        });
        return handled;
    }

    const targeting: ResolvedTargetingDefinition = {
        ...('runtime' in definition ? definition.targeting : runtimeDefinition.targeting),
        deterministicSort: ('runtime' in definition
            ? definition.targeting.deterministicSort
            : runtimeDefinition.targeting.deterministicSort) || 'distance_then_q_then_r'
    };

    let candidates: Point[];
    if (targeting.generator === 'self') {
        candidates = targeting.exposeSelfTarget === false ? [] : [attacker.position];
    } else if (targeting.generator === 'owner_hex') {
        const owner = resolveOwnerActor(state, attacker);
        candidates = owner ? [owner.position] : [];
    } else if (targeting.generator === 'movement_reachable') {
        candidates = resolveRuntimeReachableMovementTargets(runtimeDefinition, state, attacker);
    } else if (targeting.generator === 'anchor_point') {
        candidates = resolveAnchorPoint(attacker) ? [resolveAnchorPoint(attacker)!] : [];
    } else if (targeting.generator === 'axial_ray') {
        candidates = SpatialSystem.getAxialTargets(state, attacker.position, targeting.range);
    } else if (targeting.generator === 'radius') {
        candidates = SpatialSystem.getAreaTargets(state, attacker.position, targeting.radius ?? targeting.range);
    } else {
        candidates = getGridForShape(state.gridWidth, state.gridHeight, state.mapShape);
        candidates = candidates.filter(candidate => {
            const distance = hexDistance(attacker.position, candidate);
            if (distance === 0) return targeting.generator === 'single' ? false : false;
            return distance <= targeting.range;
        });
        if (targeting.generator === 'diagonal_landing') {
            candidates = candidates.filter(candidate => !isAxialAlignment(attacker.position, candidate, 'ANY'));
        }
    }

    const filtered: Point[] = [];
    for (const candidate of candidates) {
        const passes = (targeting.predicates || []).every(predicate =>
            evaluateRuntimeSkillPredicate(predicate, state, attacker, candidate, trace)
        );
        const spawnAllowed = passes && validateRuntimeCompanionSpawnTarget(runtimeDefinition, state, attacker, candidate);
        const anchorPointAllowed = passes
            && spawnAllowed
            && (targeting.generator === 'anchor_point'
                ? validateAnchorPointMoveTarget(runtimeDefinition, state, attacker, candidate)
                : true);
        const movementAllowed = passes
            && spawnAllowed
            && anchorPointAllowed
            && (targeting.generator === 'movement_reachable'
                ? true
                : validateRuntimeMovementTarget(runtimeDefinition, state, attacker, candidate));
        appendTrace(trace, {
            kind: 'target',
            path: `targeting.candidates.${createHex(candidate.q, candidate.r).q},${createHex(candidate.q, candidate.r).r}`,
            message: passes && movementAllowed ? 'Accepted target candidate.' : 'Rejected target candidate.',
            metadata: { candidate, generator: targeting.generator, spawnAllowed, anchorPointAllowed }
        });
        if (passes && movementAllowed) filtered.push(candidate);
    }

    return sortTargets(attacker.position, filtered, targeting.deterministicSort);
};

export const isRuntimeSkillTargetValid = (
    definition: SkillRuntimeDefinition | ResolvedSkillRuntime,
    state: GameState,
    attacker: Actor,
    target: Point,
    trace: ResolutionTrace
): boolean => {
    return resolveRuntimeSkillValidTargets(definition, state, attacker, trace).some(candidate =>
        candidate.q === target.q
        && candidate.r === target.r
        && candidate.s === target.s
    );
};

export const resolveRuntimeSkillTargetActor = (
    state: GameState,
    target?: Point
): Actor | undefined => {
    if (!target) return undefined;
    return resolveActorAt(state, target);
};

export const resolveRuntimeSkillActorById = resolveActorById;
