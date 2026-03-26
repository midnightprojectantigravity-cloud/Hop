import { hexDistance, hexEquals, pointToKey } from '../../hex';
import type { Action, Actor, GameState, Point, SkillAiProfile, SkillIntentProfile } from '../../types';
import { SkillRegistry } from '../../skillRegistry';
import { previewActionOutcome } from '../action-preview';
import { resolveCombatPressureMode } from '../free-move';
import { resolveWaitPreview } from '../ires';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { seededChoiceSource } from './core/tiebreak';
import { getAiResourceSignals } from './resource-signals';
import type { StrategicIntent } from './strategic-policy';

export type GenericUnitAiSide = 'player' | 'enemy' | 'companion';

export interface GenericUnitAiCandidate {
    action: Action;
    score: number;
    reasoningCode: string;
    breakdown: Record<string, number>;
    skillId?: string;
    target?: Point;
}

export interface GenericUnitAiContext {
    state: GameState;
    actor: Actor;
    side: GenericUnitAiSide;
    simSeed: string;
    decisionCounter: number;
    strategicIntent?: StrategicIntent;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(enemy => enemy.id === actorId) || state.companions?.find(companion => companion.id === actorId);
};

const getOpposingActors = (state: GameState, actor: Actor): Actor[] => [
    state.player,
    ...state.enemies,
    ...(state.companions || [])
].filter(unit => unit.id !== actor.id && unit.hp > 0 && unit.factionId !== actor.factionId);

const getReadySkillDefinitions = (actor: Actor) =>
    (actor.activeSkills || [])
        .filter(skill => (skill.currentCooldown || 0) <= 0)
        .map(skill => ({
            skill,
            definition: SkillRegistry.get(String(skill.id))
        }))
        .filter((entry): entry is { skill: Actor['activeSkills'][number]; definition: NonNullable<ReturnType<typeof SkillRegistry.get>> } => !!entry.definition);

const resolveMaxReadySkillRange = (actor: Actor): number =>
    Math.max(
        1,
        ...getReadySkillDefinitions(actor)
            .filter(entry => entry.definition.slot !== 'passive')
            .map(entry => Math.max(0, Number(entry.definition.baseVariables.range || 0)))
    );

const resolveLocalHorizon = (actor: Actor): number =>
    clamp(resolveMaxReadySkillRange(actor) + 2, 3, 6);

const getPlayerVisibleActorIds = (state: GameState): Set<string> =>
    new Set([
        ...(state.visibility?.playerFog.visibleActorIds || []),
        ...(state.visibility?.playerFog.detectedActorIds || [])
    ]);

const getVisibleOpposingActors = (
    state: GameState,
    actor: Actor,
    side: GenericUnitAiSide,
    localHorizon: number
): Actor[] => {
    const hostiles = getOpposingActors(state, actor);
    if (side === 'player' || side === 'companion') {
        const visibleIds = getPlayerVisibleActorIds(state);
        return hostiles.filter(hostile =>
            hexDistance(actor.position, hostile.position) <= localHorizon
            && (visibleIds.size === 0 || visibleIds.has(hostile.id))
        );
    }

    const awareness = state.visibility?.enemyAwarenessById?.[actor.id];
    return hostiles.filter(hostile => {
        if (hexDistance(actor.position, hostile.position) > localHorizon) return false;
        if (hostile.id !== state.player.id) return true;
        return !state.visibility
            || awareness?.lastSeenTurn === state.turnNumber
            || hexEquals(hostile.position, actor.position);
    });
};

const resolveEnemyMemoryTarget = (state: GameState, actor: Actor): Point | undefined => {
    const awareness = state.visibility?.enemyAwarenessById?.[actor.id];
    if (!awareness?.lastKnownPlayerPosition || awareness.memoryTurnsRemaining <= 0) return undefined;
    return awareness.lastKnownPlayerPosition;
};

const resolveObjectiveTarget = (
    context: GenericUnitAiContext,
    visibleHostiles: Actor[]
): Point | undefined => {
    if (visibleHostiles.length > 0) {
        return [...visibleHostiles]
            .sort((left, right) =>
                hexDistance(context.actor.position, left.position) - hexDistance(context.actor.position, right.position)
            )[0]?.position;
    }

    if (context.side === 'enemy') {
        return resolveEnemyMemoryTarget(context.state, context.actor);
    }

    const hpRatio = Number(context.actor.hp || 0) / Math.max(1, Number(context.actor.maxHp || 1));
    if (hpRatio < 0.55 && context.state.shrinePosition) return context.state.shrinePosition;
    return context.state.stairsPosition;
};

const nearestHostileDistance = (origin: Point, hostiles: Actor[]): number => {
    if (hostiles.length === 0) return 99;
    return Math.min(...hostiles.map(hostile => hexDistance(origin, hostile.position)));
};

const computeExposure = (origin: Point, hostiles: Actor[]): number => {
    if (hostiles.length === 0) return 0;
    return hostiles.reduce((sum, hostile) => {
        const hostileRange = Math.max(
            1,
            ...getReadySkillDefinitions(hostile)
                .filter(entry => entry.definition.slot !== 'passive')
                .map(entry => Math.max(1, Number(entry.definition.baseVariables.range || 1)))
        );
        const dist = hexDistance(origin, hostile.position);
        const pressure = dist <= hostileRange
            ? 1 + Math.max(0, hostileRange - dist) * 0.25
            : Math.max(0, 0.35 - ((dist - hostileRange) * 0.12));
        return sum + pressure;
    }, 0);
};

const computeDesiredRangeScore = (
    actorPosition: Point,
    hostiles: Actor[],
    aiProfile?: SkillAiProfile
): number => {
    const desired = aiProfile?.desiredRange;
    if (!desired || hostiles.length === 0) return 0;
    const dist = nearestHostileDistance(actorPosition, hostiles);
    if (Array.isArray(desired)) {
        if (dist < desired[0]) return -((desired[0] - dist) * 2.5);
        if (dist > desired[1]) return -((dist - desired[1]) * 1.5);
        return 5;
    }
    return Math.max(-6, 4 - Math.abs(dist - desired) * 2);
};

const resolveTargetRules = (profile?: SkillIntentProfile): string[] =>
    [...(profile?.ai?.targetRules || [])];

const computeTargetRuleScore = (
    target: Point | undefined,
    actor: Actor,
    visibleHostiles: Actor[],
    objectiveTarget: Point | undefined,
    profile?: SkillIntentProfile
): number => {
    if (!target) return 0;
    const rules = resolveTargetRules(profile);
    if (rules.length === 0) return 0;

    const actorAtTarget = visibleHostiles.find(hostile => hexEquals(hostile.position, target));
    const hostileAdjacency = visibleHostiles.filter(hostile => hexDistance(hostile.position, target) === 1).length;
    let score = 0;

    for (const rule of rules) {
        switch (rule) {
            case 'direct_hit':
                score += actorAtTarget ? 10 : -4;
                break;
            case 'enemy_density':
                score += hostileAdjacency * 4;
                break;
            case 'empty_tile_adjacent_to_enemy':
                score += !actorAtTarget ? hostileAdjacency * 6 : -8;
                break;
            case 'empty_tile_on_route':
                score += objectiveTarget && !actorAtTarget
                    ? Math.max(0, hexDistance(actor.position, objectiveTarget) - hexDistance(target, objectiveTarget)) * 2
                    : 0;
                break;
            case 'objective_progress':
                score += objectiveTarget
                    ? Math.max(0, hexDistance(actor.position, objectiveTarget) - hexDistance(target, objectiveTarget)) * 2.5
                    : 0;
                break;
            case 'self_preservation':
                score += Math.max(0, nearestHostileDistance(target, visibleHostiles) - nearestHostileDistance(actor.position, visibleHostiles)) * 2;
                break;
            case 'avoid_self_blast':
                score -= hexDistance(actor.position, target) <= 1 ? 12 : 0;
                break;
            case 'escape_exposure':
                score += Math.max(0, computeExposure(actor.position, visibleHostiles) - computeExposure(target, visibleHostiles)) * 3;
                break;
            default:
                break;
        }
    }

    return score;
};

const rankMoveTargets = (
    context: GenericUnitAiContext,
    targets: Point[],
    visibleHostiles: Actor[],
    objectiveTarget: Point | undefined
): Point[] => {
    return [...targets]
        .sort((left, right) => {
            const leftScore =
                Math.max(0, (objectiveTarget ? hexDistance(context.actor.position, objectiveTarget) - hexDistance(left, objectiveTarget) : 0)) * 3
                + Math.max(0, computeExposure(context.actor.position, visibleHostiles) - computeExposure(left, visibleHostiles)) * 4
                + computeDesiredRangeScore(left, visibleHostiles, { desiredRange: [2, 4] });
            const rightScore =
                Math.max(0, (objectiveTarget ? hexDistance(context.actor.position, objectiveTarget) - hexDistance(right, objectiveTarget) : 0)) * 3
                + Math.max(0, computeExposure(context.actor.position, visibleHostiles) - computeExposure(right, visibleHostiles)) * 4
                + computeDesiredRangeScore(right, visibleHostiles, { desiredRange: [2, 4] });
            return rightScore - leftScore || pointToKey(left).localeCompare(pointToKey(right));
        })
        .slice(0, 6);
};

const rankSkillTargets = (
    context: GenericUnitAiContext,
    targets: Point[],
    profile: SkillIntentProfile | undefined,
    visibleHostiles: Actor[],
    objectiveTarget: Point | undefined
): Point[] =>
    [...targets]
        .sort((left, right) =>
            computeTargetRuleScore(right, context.actor, visibleHostiles, objectiveTarget, profile)
            - computeTargetRuleScore(left, context.actor, visibleHostiles, objectiveTarget, profile)
            || pointToKey(left).localeCompare(pointToKey(right))
        )
        .slice(0, 4);

const buildActionCandidates = (
    context: GenericUnitAiContext,
    visibleHostiles: Actor[],
    objectiveTarget: Point | undefined,
    localHorizon: number
): Action[] => {
    const candidates: Action[] = [{ type: 'WAIT' }];
    const seen = new Set<string>(['WAIT']);
    const readySkills = getReadySkillDefinitions(context.actor);

    if (readySkills.some(entry => entry.skill.id === 'BASIC_MOVE')) {
        const moveTargets = SkillRegistry.get('BASIC_MOVE')?.getValidTargets?.(context.state, context.actor.position) || [];
        for (const target of rankMoveTargets(context, moveTargets, visibleHostiles, objectiveTarget)) {
            const key = `MOVE:${pointToKey(target)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push({ type: 'MOVE', payload: target });
        }
    }

    for (const entry of readySkills) {
        const skillId = String(entry.skill.id);
        if (skillId === 'AUTO_ATTACK' || skillId === 'BASIC_MOVE') continue;
        if (entry.definition.slot === 'passive') continue;
        if (entry.definition.intentProfile?.economy?.consumesTurn === false) continue;

        let targets = entry.definition.getValidTargets?.(context.state, context.actor.position) || [];
        if ((!targets || targets.length === 0) && entry.definition.intentProfile?.target.pattern === 'self') {
            targets = [context.actor.position];
        }
        if (!targets.length) continue;

        const filteredTargets = targets.filter(target =>
            hexDistance(context.actor.position, target) <= Math.max(localHorizon, entry.definition.baseVariables.range || 0)
            || (objectiveTarget ? hexDistance(target, objectiveTarget) <= localHorizon : false)
        );
        const rankedTargets = rankSkillTargets(
            context,
            filteredTargets.length > 0 ? filteredTargets : targets,
            entry.definition.intentProfile,
            visibleHostiles,
            objectiveTarget
        );

        for (const target of rankedTargets) {
            const key = `${skillId}:${pointToKey(target)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            candidates.push({
                type: 'USE_SKILL',
                payload: {
                    skillId,
                    target
                }
            });
        }
    }

    return candidates;
};

const resolveIntentBias = (strategicIntent: StrategicIntent | undefined) => {
    switch (strategicIntent) {
        case 'defense':
            return { offense: 0.7, defense: 1.35, control: 1, objective: 0.8 };
        case 'control':
            return { offense: 0.95, defense: 1, control: 1.35, objective: 0.9 };
        case 'positioning':
            return { offense: 0.85, defense: 1.1, control: 1, objective: 1.25 };
        case 'offense':
        default:
            return { offense: 1.25, defense: 0.85, control: 0.95, objective: 0.9 };
    }
};

const getCandidateSkillProfile = (action: Action): SkillIntentProfile | undefined => {
    if (action.type !== 'USE_SKILL') return undefined;
    return SkillRegistry.get(action.payload.skillId)?.intentProfile;
};

const evaluateCandidate = (
    context: GenericUnitAiContext,
    action: Action,
    visibleHostiles: Actor[],
    objectiveTarget: Point | undefined
): GenericUnitAiCandidate => {
    const actorBefore = resolveActorById(context.state, context.actor.id) || context.actor;
    const intentBias = resolveIntentBias(context.strategicIntent);
    const hostileIds = new Set(getOpposingActors(context.state, context.actor).map(hostile => hostile.id));
    const profile = getCandidateSkillProfile(action);
    const aiProfile = profile?.ai;
    const breakdown: Record<string, number> = {};

    if (action.type === 'WAIT') {
        const preview = resolveWaitPreview(actorBefore, context.state.ruleset, resolveCombatPressureMode(context.state));
        const signals = getAiResourceSignals(actorBefore.ires);
        breakdown.recovery = Number(preview.turnProjection.projectedSparkRecoveryIfEndedNow || 0) * 0.18 * intentBias.defense;
        breakdown.reserve = (1 - signals.sparkRatio) * 18 * intentBias.defense;
        breakdown.redline = preview.sparkBurnOutcome === 'burn_now' ? -22 : 0;
        breakdown.objective = visibleHostiles.length === 0 && objectiveTarget ? -6 * intentBias.objective : 0;
        breakdown.exhausted = actorBefore.ires?.currentState === 'exhausted' ? 10 : 0;
        const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
        return {
            action,
            skillId: 'WAIT',
            reasoningCode: 'GENERIC_WAIT',
            score,
            breakdown
        };
    }

    const skillId = action.type === 'MOVE' ? 'BASIC_MOVE' : action.payload.skillId;
    const target = action.type === 'MOVE' ? action.payload : action.payload.target;
    const preview = previewActionOutcome(context.state, {
        actorId: context.actor.id,
        skillId,
        target
    });

    if (!preview.ok || !preview.predictedState) {
        return {
            action,
            skillId,
            target,
            reasoningCode: `BLOCKED_${skillId}`,
            score: Number.NEGATIVE_INFINITY,
            breakdown: {
                blocked: -1000
            }
        };
    }

    const predictedActor = resolveActorById(preview.predictedState, context.actor.id) || actorBefore;
    const hostilesBefore = getOpposingActors(context.state, context.actor);
    const hostilesAfter = getOpposingActors(preview.predictedState, predictedActor);
    const hostileByIdAfter = new Map(hostilesAfter.map(hostile => [hostile.id, hostile]));
    const visibleAfter = getVisibleOpposingActors(preview.predictedState, predictedActor, context.side, resolveLocalHorizon(predictedActor));

    const directDamage = hostilesBefore.reduce((sum, hostile) => {
        const next = hostileByIdAfter.get(hostile.id);
        return sum + Math.max(0, hostile.hp - Number(next?.hp || 0));
    }, 0);
    const killCount = hostilesBefore.filter(hostile => !hostileByIdAfter.has(hostile.id)).length;
    const selfDamage = Math.max(0, actorBefore.hp - predictedActor.hp);
    const objectiveDelta = objectiveTarget
        ? Math.max(0, hexDistance(actorBefore.position, objectiveTarget) - hexDistance(predictedActor.position, objectiveTarget))
        : 0;
    const exposureBefore = computeExposure(actorBefore.position, visibleHostiles);
    const exposureAfter = computeExposure(predictedActor.position, visibleAfter);
    const resourcePreview = preview.resourcePreview;
    const sparkRatio = Math.max(0, Number(resourcePreview?.sparkCostTotal || 0)) / Math.max(1, Number(actorBefore.ires?.maxSpark || 1));
    const manaRatio = Math.max(0, Number(resourcePreview?.manaCost || 0)) / Math.max(1, Number(actorBefore.ires?.maxMana || 1));
    const projectedRecovery = Math.max(0, Number(resourcePreview?.turnProjection.projectedSparkRecoveryIfEndedNow || 0)) / Math.max(1, Number(actorBefore.ires?.maxSpark || 1));
    const targetRuleScore = computeTargetRuleScore(target, actorBefore, visibleHostiles, objectiveTarget, profile);
    const desiredRangeScore = computeDesiredRangeScore(predictedActor.position, visibleAfter, aiProfile);
    const persistenceScore = aiProfile?.persistence
        ? ((aiProfile.persistence.turns || 0) * 3) + (aiProfile.persistence.radius || 0) * 2
        : 0;
    const safeAfterUse = aiProfile?.preferSafeAfterUse
        ? Math.max(0, exposureBefore - exposureAfter) * 2
        : 0;
    const standingOnHazard = UnifiedTileService.getTileAt(preview.predictedState, predictedActor.position)?.traits.has('HAZARDOUS')
        ? 1
        : 0;

    breakdown.damage = directDamage * 3.4 * intentBias.offense;
    breakdown.kills = killCount * 18 * intentBias.offense;
    breakdown.objective = objectiveDelta * 3 * intentBias.objective;
    breakdown.targeting = targetRuleScore * 1.1;
    breakdown.range = desiredRangeScore;
    breakdown.persistence = persistenceScore * intentBias.control;
    breakdown.exposure = (exposureBefore - exposureAfter) * 6 * intentBias.defense;
    breakdown.safe_after = safeAfterUse;
    breakdown.self_damage = -selfDamage * 8 * intentBias.defense;
    breakdown.hazard = -standingOnHazard * 18;
    breakdown.spark = -sparkRatio * 22;
    breakdown.mana = -manaRatio * 16;
    breakdown.recovery = projectedRecovery * 10 * intentBias.defense;
    breakdown.exhausted = resourcePreview?.turnProjection.stateAfter === 'exhausted' ? -18 : 0;
    breakdown.burn = resourcePreview?.sparkBurnOutcome === 'burn_now'
        ? -24
        : resourcePreview?.sparkBurnOutcome === 'travel_suppressed'
            ? 6
            : 0;

    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return {
        action,
        skillId,
        target,
        reasoningCode: action.type === 'MOVE' ? 'GENERIC_MOVE' : `GENERIC_${skillId}`,
        score,
        breakdown
    };
};

export const selectGenericUnitAiAction = (
    context: GenericUnitAiContext
): { selected: GenericUnitAiCandidate; candidates: GenericUnitAiCandidate[] } => {
    const localHorizon = resolveLocalHorizon(context.actor);
    const visibleHostiles = getVisibleOpposingActors(context.state, context.actor, context.side, localHorizon);
    const objectiveTarget = resolveObjectiveTarget(context, visibleHostiles);
    const candidates = buildActionCandidates(context, visibleHostiles, objectiveTarget, localHorizon)
        .map(candidate => evaluateCandidate(context, candidate, visibleHostiles, objectiveTarget));

    const ranked = candidates
        .filter(candidate => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score || left.reasoningCode.localeCompare(right.reasoningCode));

    if (ranked.length === 0) {
        const fallback: GenericUnitAiCandidate = {
            action: { type: 'WAIT' },
            score: 0,
            skillId: 'WAIT',
            reasoningCode: 'GENERIC_WAIT_FALLBACK',
            breakdown: {}
        };
        return { selected: fallback, candidates: [fallback] };
    }

    const bestScore = ranked[0].score;
    const ties = ranked.filter(candidate => candidate.score === bestScore);
    const tie = seededChoiceSource.chooseIndex(ties.length, {
        seed: `${context.simSeed}:${context.actor.id}`,
        counter: context.decisionCounter
    });
    return {
        selected: ties[tie.index] || ranked[0],
        candidates: ranked
    };
};
