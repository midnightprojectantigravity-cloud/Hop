import { hexDistance, hexEquals, pointToKey } from '../../hex';
import type {
    Actor,
    AiCandidatePayoff,
    AiSparkAssessment,
    AiSparkBand,
    AiSparkDoctrineResult,
    AiRestedOpportunityMode,
    GameState,
    Point,
    ResolvedAiBehaviorProfile,
    SkillAiProfile,
    SkillIntentProfile
} from '../../types';
import { SkillRegistry } from '../../skillRegistry';
import { previewActionOutcome } from '../action-preview';
import { resolveCombatPressureMode } from '../free-move';
import { resolveWaitPreview } from '../ires';
import { getTurnStartPosition } from '../initiative';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { recomputeVisibility } from '../visibility';
import { seededChoiceSource } from './core/tiebreak';
import { resolveBehaviorAnchorTarget, resolveBehaviorProfile } from './behavior-profile';
import { getAiResourceSignals } from './resource-signals';
import {
    classifyAiSparkBand,
    classifyCandidatePayoff,
    classifyRestedOpportunityMode,
    evaluateSparkDoctrine
} from './spark-doctrine';
import type { StrategicIntent } from './strategic-policy';

export type GenericUnitAiSide = 'player' | 'enemy' | 'companion';

type GenericAiAction =
    | { type: 'WAIT' }
    | { type: 'MOVE'; payload: Point }
    | { type: 'USE_SKILL'; payload: { skillId: string; target?: Point } };

export interface GenericUnitAiCandidateFacts {
    canDamageNow: boolean;
    canKillNow: boolean;
    createsThreatNextDecision: boolean;
    improvesObjective: boolean;
    reducesExposureMaterially: boolean;
    backtracks: boolean;
    isLowValueMobility: boolean;
    isHazardSelfTrap: boolean;
}

export type GenericUnitAiEngagementMode = 'search' | 'approach' | 'engage' | 'recover';
export type GenericUnitAiCoherenceTargetKind = 'hostile' | 'anchor_actor' | 'anchor_point' | 'objective' | 'memory' | 'none';

export interface GenericUnitAiSelectionSummary {
    visibleOpponentIds: string[];
    visibleOpponentCount: number;
    attackOpportunityAvailable: boolean;
    threatOpportunityAvailable: boolean;
    engagementMode: GenericUnitAiEngagementMode;
    coherenceTargetKind: GenericUnitAiCoherenceTargetKind;
    sameTurnRetreatRejectedCount: number;
    sparkBandBefore: AiSparkBand;
    restedOpportunityMode: AiRestedOpportunityMode;
    safeSecondActionAvailable: boolean;
    voluntaryExhaustionAttemptCount: number;
    voluntaryExhaustionAllowedCount: number;
    voluntaryExhaustionBlockedCount: number;
    selectedPayoff?: AiCandidatePayoff;
    selectedSparkBandAfter?: AiSparkBand;
    selectedSparkBandIfEndedNow?: AiSparkBand;
    selectedRestedDecision?: AiSparkDoctrineResult['restedDecision'];
    selectedWaitForBandPreservation?: boolean;
    selectedWouldEnterExhausted?: boolean;
    selectedWouldActWhileExhausted?: boolean;
    selectedWouldExitRested?: boolean;
    selectedWouldPreserveRested?: boolean;
    selectedWouldReenterRested?: boolean;
    selectedIsTrueRestTurn?: boolean;
    selectedActionOrdinal?: number;
    selectedOverride?: AiSparkDoctrineResult['override'];
    selectedGateReason?: AiSparkDoctrineResult['gateReason'];
    behaviorProfile?: ResolvedAiBehaviorProfile;
}

export interface GenericUnitAiCandidate {
    action: GenericAiAction;
    score: number;
    reasoningCode: string;
    breakdown: Record<string, number>;
    skillId?: string;
    target?: Point;
    facts?: GenericUnitAiCandidateFacts;
    payoff?: AiCandidatePayoff;
    sparkAssessment?: AiSparkAssessment;
    sparkDoctrine?: AiSparkDoctrineResult;
}

export interface GenericUnitAiContext {
    state: GameState;
    actor: Actor;
    side: GenericUnitAiSide;
    simSeed: string;
    decisionCounter: number;
    strategicIntent?: StrategicIntent;
}

const ZERO_FACTS: GenericUnitAiCandidateFacts = {
    canDamageNow: false,
    canKillNow: false,
    createsThreatNextDecision: false,
    improvesObjective: false,
    reducesExposureMaterially: false,
    backtracks: false,
    isLowValueMobility: false,
    isHazardSelfTrap: false
};

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

const resolveCoherenceTarget = (
    context: GenericUnitAiContext,
    visibleHostiles: Actor[],
    _behaviorProfile: ResolvedAiBehaviorProfile
): { point?: Point; kind: GenericUnitAiCoherenceTargetKind } => {
    const anchor = resolveBehaviorAnchorTarget(context.state, context.actor);
    if (anchor.kind === 'anchor_actor' || anchor.kind === 'anchor_point') {
        return {
            point: anchor.point,
            kind: anchor.kind
        };
    }

    if (visibleHostiles.length > 0) {
        return {
            point: [...visibleHostiles]
                .sort((left, right) =>
                    hexDistance(context.actor.position, left.position) - hexDistance(context.actor.position, right.position)
                )[0]?.position,
            kind: 'hostile'
        };
    }

    if (context.side === 'enemy') {
        const memoryTarget = resolveEnemyMemoryTarget(context.state, context.actor);
        if (memoryTarget) {
            return {
                point: memoryTarget,
                kind: 'memory'
            };
        }
    }

    const hpRatio = Number(context.actor.hp || 0) / Math.max(1, Number(context.actor.maxHp || 1));
    if (hpRatio < 0.55 && context.state.shrinePosition) {
        return {
            point: context.state.shrinePosition,
            kind: 'objective'
        };
    }
    return {
        point: context.state.stairsPosition,
        kind: 'objective'
    };
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
    targetPoint: Point | undefined,
    behaviorProfile?: ResolvedAiBehaviorProfile
): number => {
    const desired = behaviorProfile?.desiredRange;
    if (!desired) return 0;
    if (!targetPoint) return 0;
    const dist = hexDistance(actorPosition, targetPoint);
    if (Array.isArray(desired)) {
        if (dist < desired[0]) return -((desired[0] - dist) * 2.5);
        if (dist > desired[1]) return -((dist - desired[1]) * 1.5);
        return 5;
    }
    return Math.max(-6, 4 - Math.abs(dist - desired) * 2);
};
const isCloseRangePosture = (behaviorProfile?: ResolvedAiBehaviorProfile): boolean => {
    const desired = behaviorProfile?.desiredRange;
    if (desired === undefined) return false;
    if (Array.isArray(desired)) return desired[0] <= 1 && desired[1] <= 2;
    return desired <= 1;
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

const computeEstimatedIntentValue = (
    action: GenericAiAction,
    target: Point | undefined,
    visibleHostiles: Actor[],
    objectiveTarget: Point | undefined,
    profile: SkillIntentProfile | undefined,
    intentBias: ReturnType<typeof resolveIntentBias>
): number => {
    if (!profile || action.type === 'MOVE') return 0;
    const aoeRadius = Math.max(0, Number(profile.target.aoeRadius || 0));
    const hostileAtTarget = target
        ? visibleHostiles.some(hostile => hexEquals(hostile.position, target))
        : false;
    const affectedHostiles = target
        ? visibleHostiles.filter(hostile => hexDistance(hostile.position, target) <= aoeRadius).length
        : 0;
    const objectiveFactor = target && objectiveTarget && hexDistance(target, objectiveTarget) <= 1 ? 0.5 : 0;
    const tacticalFactor = Math.max(
        hostileAtTarget ? 1 : 0,
        affectedHostiles > 0 ? affectedHostiles / Math.max(1, aoeRadius + 1) : 0,
        objectiveFactor
    );

    if (tacticalFactor <= 0) return 0;

    const estimates = profile.estimates;
    return (
        Number(estimates.damage || 0) * 1.5 * intentBias.offense
        + Number(estimates.control || 0) * 1.2 * intentBias.control
        + Number(estimates.healing || 0) * 1.25 * intentBias.defense
        + Number(estimates.shielding || 0) * 0.9 * intentBias.defense
        + Number(estimates.summon || 0) * 1.15 * intentBias.control
    ) * tacticalFactor;
};

const rankMoveTargets = (
    context: GenericUnitAiContext,
    targets: Point[],
    visibleHostiles: Actor[],
    coherenceTarget: Point | undefined,
    behaviorProfile: ResolvedAiBehaviorProfile
): Point[] => {
    const exposureWeight = isCloseRangePosture(behaviorProfile) ? 1.5 : 4;
    return [...targets]
        .sort((left, right) => {
            const leftScore =
                Math.max(0, (coherenceTarget ? hexDistance(context.actor.position, coherenceTarget) - hexDistance(left, coherenceTarget) : 0)) * 3
                + Math.max(0, computeExposure(context.actor.position, visibleHostiles) - computeExposure(left, visibleHostiles)) * exposureWeight
                + computeDesiredRangeScore(left, coherenceTarget, behaviorProfile);
            const rightScore =
                Math.max(0, (coherenceTarget ? hexDistance(context.actor.position, coherenceTarget) - hexDistance(right, coherenceTarget) : 0)) * 3
                + Math.max(0, computeExposure(context.actor.position, visibleHostiles) - computeExposure(right, visibleHostiles)) * exposureWeight
                + computeDesiredRangeScore(right, coherenceTarget, behaviorProfile);
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
    coherenceTarget: Point | undefined,
    localHorizon: number,
    behaviorProfile: ResolvedAiBehaviorProfile
): GenericAiAction[] => {
    const candidates: GenericAiAction[] = [{ type: 'WAIT' }];
    const seen = new Set<string>(['WAIT']);
    const readySkills = getReadySkillDefinitions(context.actor);

    if (readySkills.some(entry => entry.skill.id === 'BASIC_MOVE')) {
        const moveTargets = SkillRegistry.get('BASIC_MOVE')?.getValidTargets?.(context.state, context.actor.position) || [];
        for (const target of rankMoveTargets(context, moveTargets, visibleHostiles, coherenceTarget, behaviorProfile)) {
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
            || (coherenceTarget ? hexDistance(target, coherenceTarget) <= localHorizon : false)
        );
        const rankedTargets = rankSkillTargets(
            context,
            filteredTargets.length > 0 ? filteredTargets : targets,
            entry.definition.intentProfile,
            visibleHostiles,
            coherenceTarget
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

const getCandidateSkillProfile = (action: GenericAiAction): SkillIntentProfile | undefined => {
    if (action.type !== 'USE_SKILL') return undefined;
    return SkillRegistry.get(action.payload.skillId)?.intentProfile;
};

const computeDirectDamageAndKills = (
    beforeState: GameState,
    afterState: GameState,
    actor: Actor
): { directDamage: number; killCount: number } => {
    const hostilesBefore = getOpposingActors(beforeState, actor);
    const afterActor = resolveActorById(afterState, actor.id) || actor;
    const hostilesAfter = getOpposingActors(afterState, afterActor);
    const hostileByIdAfter = new Map(hostilesAfter.map(hostile => [hostile.id, hostile]));
    const directDamage = hostilesBefore.reduce((sum, hostile) => {
        const next = hostileByIdAfter.get(hostile.id);
        return sum + Math.max(0, hostile.hp - Number(next?.hp || 0));
    }, 0);
    const killCount = hostilesBefore.filter(hostile => !hostileByIdAfter.has(hostile.id)).length;
    return { directDamage, killCount };
};

const hasImmediateDamageOption = (
    state: GameState,
    actor: Actor
): boolean => {
    const readySkills = getReadySkillDefinitions(actor);

    for (const entry of readySkills) {
        const skillId = String(entry.skill.id);
        if (skillId === 'AUTO_ATTACK' || skillId === 'BASIC_MOVE') continue;
        if (entry.definition.slot === 'passive') continue;
        if (entry.definition.intentProfile?.economy?.consumesTurn === false) continue;

        let targets = entry.definition.getValidTargets?.(state, actor.position) || [];
        if ((!targets || targets.length === 0) && entry.definition.intentProfile?.target.pattern === 'self') {
            targets = [actor.position];
        }

        for (const target of targets) {
            const preview = previewActionOutcome(state, {
                actorId: actor.id,
                skillId,
                target
            });
            if (!preview.ok || !preview.predictedState) continue;
            const { directDamage, killCount } = computeDirectDamageAndKills(state, preview.predictedState, actor);
            if (directDamage > 0 || killCount > 0) return true;
        }
    }

    return false;
};

const createsPersistentThreatWindow = (
    target: Point | undefined,
    visibleHostiles: Actor[],
    profile: SkillIntentProfile | undefined
): boolean => {
    if (!target || !profile?.ai?.persistence) return false;
    if (!profile.intentTags.some(tag => tag === 'damage' || tag === 'control' || tag === 'hazard')) {
        return false;
    }

    const threatRadius = Math.max(
        1,
        Number(profile.ai.persistence.radius || 0),
        Number(profile.target.aoeRadius || 0)
    );
    return visibleHostiles.some(hostile => hexDistance(hostile.position, target) <= threatRadius);
};

const resolveEngagementMode = (
    actor: Actor,
    visibleHostiles: Actor[],
    candidates: GenericUnitAiCandidate[]
): GenericUnitAiEngagementMode => {
    if (visibleHostiles.length === 0) return 'search';

    const hpRatio = Number(actor.hp || 0) / Math.max(1, Number(actor.maxHp || 1));
    if (actor.ires?.currentState === 'exhausted' || hpRatio < 0.35) {
        return 'recover';
    }

    if (candidates.some(candidate => candidate.facts?.canDamageNow || candidate.facts?.createsThreatNextDecision)) {
        return 'engage';
    }

    return 'approach';
};

const applyTacticalPass = (
    candidate: GenericUnitAiCandidate,
    summary: GenericUnitAiSelectionSummary
): GenericUnitAiCandidate => {
    if (!Number.isFinite(candidate.score)) {
        return candidate;
    }
    const facts = candidate.facts || ZERO_FACTS;
    const breakdown = { ...candidate.breakdown };
    const healthyEnoughToPush = summary.safeSecondActionAvailable
        || summary.sparkBandBefore === 'rested_hold'
        || summary.sparkBandBefore === 'stable';
    const behavior = summary.behaviorProfile;
    const offenseBias = Math.max(0.5, behavior?.offenseBias || 1);
    const commitBias = Math.max(0.5, behavior?.commitBias || 1);
    const followThroughBias = Math.max(0.5, behavior?.followThroughBias || 1);
    const safetyBias = Math.max(0.25, behavior?.selfPreservationBias || 0.45);
    const isCloseRangeAction = candidate.skillId === 'BASIC_MOVE' || candidate.skillId === 'BASIC_ATTACK';
    const preservesBandByWaiting = candidate.action.type === 'WAIT' && !!candidate.sparkDoctrine?.waitForBandPreservation;

    if (facts.canKillNow) breakdown.kill_now_bonus = 28 * offenseBias;
    if (facts.canDamageNow) breakdown.damage_now_bonus = 16 * offenseBias;
    if (facts.canDamageNow && behavior?.preferDamageOverPositioning) {
        breakdown.damage_over_positioning_bonus = 8 * offenseBias;
    }
    if (facts.createsThreatNextDecision) breakdown.threaten_next_bonus = 14 * commitBias;
    if (!facts.canDamageNow && facts.createsThreatNextDecision) breakdown.follow_through_bonus = 8 * followThroughBias;
    if (facts.backtracks) breakdown.backtrack_penalty = -18 * commitBias;
    if (facts.isLowValueMobility) breakdown.low_value_mobility_penalty = -18;
    if (facts.isHazardSelfTrap) breakdown.hazard_self_trap_penalty = -18 * safetyBias;

    const noProgress = !facts.canDamageNow
        && !facts.createsThreatNextDecision
        && !facts.improvesObjective
        && !facts.reducesExposureMaterially;
    if (noProgress) breakdown.no_progress_penalty = -14 * Math.max(0.75, commitBias);

    if (summary.engagementMode === 'engage') {
        if (isCloseRangeAction && facts.canDamageNow) breakdown.engage_commit_bonus = 10 * commitBias;
        if (candidate.action.type === 'WAIT' && summary.visibleOpponentCount > 0) {
            breakdown.idle_visible_hostile_penalty = (
                healthyEnoughToPush && !preservesBandByWaiting
                    ? (summary.attackOpportunityAvailable ? -32 : -20)
                    : -4
            ) * offenseBias;
        }
    } else if (summary.engagementMode === 'approach') {
        if (facts.createsThreatNextDecision) breakdown.approach_window_bonus = 10 * commitBias;
        if (candidate.action.type === 'WAIT' && summary.visibleOpponentCount > 0) {
            breakdown.idle_visible_hostile_penalty = (healthyEnoughToPush && !preservesBandByWaiting ? -18 : -4) * offenseBias;
        }
    } else if (summary.engagementMode === 'recover') {
        if (candidate.action.type === 'WAIT') {
            breakdown.recover_wait_bonus = 12;
        }
    }

    if (candidate.action.type === 'WAIT' && preservesBandByWaiting) {
        breakdown.spark_band_preservation_bonus = 12 * Math.max(0.75, safetyBias);
    }

    if (
        candidate.action.type === 'WAIT'
        && summary.visibleOpponentCount > 0
        && summary.engagementMode !== 'recover'
        && healthyEnoughToPush
        && !preservesBandByWaiting
    ) {
        breakdown.premature_rest_penalty = -14 * offenseBias;
    }

    if (
        candidate.action.type === 'WAIT'
        && summary.threatOpportunityAvailable
        && summary.engagementMode !== 'recover'
        && healthyEnoughToPush
        && !preservesBandByWaiting
    ) {
        breakdown.wait_missed_threat_penalty = -12 * commitBias;
    }

    if (
        candidate.action.type === 'WAIT'
        && summary.attackOpportunityAvailable
        && summary.engagementMode !== 'recover'
        && healthyEnoughToPush
        && !preservesBandByWaiting
    ) {
        breakdown.wait_missed_attack_penalty = -20 * offenseBias;
    }

    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return {
        ...candidate,
        breakdown,
        score
    };
};

const applySparkDoctrinePass = (
    candidate: GenericUnitAiCandidate,
    _actor: Actor,
    restedOpportunityMode: AiRestedOpportunityMode,
    hasStandardOrBetterNonExhaustingAlternative: boolean,
    behaviorProfile: ResolvedAiBehaviorProfile
): GenericUnitAiCandidate => {
    if (!Number.isFinite(candidate.score) || !candidate.sparkAssessment || !candidate.payoff) {
        return candidate;
    }

    const doctrine = evaluateSparkDoctrine({
        actionType: candidate.action.type,
        payoff: candidate.payoff,
        assessment: candidate.sparkAssessment,
        restedOpportunityMode,
        hasStandardOrBetterNonExhaustingAlternative,
        disciplineMultiplier: resolveSparkDisciplineModifier(behaviorProfile)
    });

    const breakdown = {
        ...candidate.breakdown,
        spark_doctrine: doctrine.sparkScoreDelta
    };

    if (!doctrine.allowed) {
        return {
            ...candidate,
            score: Number.NEGATIVE_INFINITY,
            breakdown: {
                ...breakdown,
                blocked_by_spark_doctrine: -1000
            },
            sparkDoctrine: doctrine
        };
    }

    return {
        ...candidate,
        breakdown,
        score: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
        sparkDoctrine: doctrine
    };
};

const resolveCandidateMobilityRole = (candidate: GenericUnitAiCandidate): SkillAiProfile['mobilityRole'] | undefined => {
    const skillId = candidate.skillId;
    if (!skillId || skillId === 'WAIT' || skillId === 'BASIC_MOVE') return undefined;
    return SkillRegistry.get(skillId)?.intentProfile?.ai?.mobilityRole;
};

const applyMobilityShadowPass = (
    candidates: GenericUnitAiCandidate[]
): GenericUnitAiCandidate[] => {
    const basicMoveCandidates = candidates.filter(candidate =>
        candidate.skillId === 'BASIC_MOVE'
        && Number.isFinite(candidate.score)
    );

    if (basicMoveCandidates.length === 0) return candidates;

    return candidates.map(candidate => {
        if (resolveCandidateMobilityRole(candidate) !== 'gap_close') return candidate;
        const facts = candidate.facts || ZERO_FACTS;
        if (!facts.canDamageNow && !facts.createsThreatNextDecision) return candidate;

        const shadowingMove = basicMoveCandidates.find(moveCandidate => {
            const moveFacts = moveCandidate.facts || ZERO_FACTS;
            const moveCreatesEqualOrBetterWindow = facts.canDamageNow
                ? moveFacts.canDamageNow
                : (moveFacts.canDamageNow || moveFacts.createsThreatNextDecision);
            if (!moveCreatesEqualOrBetterWindow) return false;
            return moveCandidate.score >= candidate.score - 6;
        });

        if (!shadowingMove) return candidate;

        const breakdown = {
            ...candidate.breakdown,
            shadowed_gap_close_penalty: -24
        };
        return {
            ...candidate,
            breakdown,
            score: Object.values(breakdown).reduce((sum, value) => sum + value, 0)
        };
    });
};

const summaryLikeApproachOrEngage = (
    context: GenericUnitAiContext,
    visibleHostiles: Actor[],
    directDamage: number,
    killCount: number,
    createsThreatNextDecision: boolean
): boolean => {
    if (visibleHostiles.length === 0) return false;
    const hpRatio = Number(context.actor.hp || 0) / Math.max(1, Number(context.actor.maxHp || 1));
    if (context.actor.ires?.currentState === 'exhausted' || hpRatio < 0.35) return false;
    if (directDamage > 0 || killCount > 0 || createsThreatNextDecision) return true;
    return true;
};

const isRestedBand = (band: AiSparkBand): boolean => band === 'rested_hold' || band === 'rested_edge';
const isStableOrBetterBand = (band: AiSparkBand): boolean => isRestedBand(band) || band === 'stable';
const isCriticalOrWorseBand = (band: AiSparkBand): boolean => band === 'critical' || band === 'exhausted';

const resolveSparkDisciplineModifier = (behaviorProfile: ResolvedAiBehaviorProfile): number => {
    const aggressiveScore = (behaviorProfile.offenseBias + behaviorProfile.commitBias + behaviorProfile.followThroughBias)
        - (behaviorProfile.selfPreservationBias + behaviorProfile.controlBias);
    const conservativeScore = (behaviorProfile.selfPreservationBias + behaviorProfile.controlBias)
        - (behaviorProfile.offenseBias + behaviorProfile.commitBias);
    if (aggressiveScore >= 1.2) return 0.9;
    if (conservativeScore >= 0.6) return 1.1;
    return 1;
};

const buildProjectedIresState = (
    actor: Actor,
    projectedSpark: number,
    projectedState: 'rested' | 'base' | 'exhausted'
) => {
    if (!actor.ires) return undefined;
    return {
        ...actor.ires,
        spark: projectedSpark,
        currentState: projectedState,
        actionCountThisTurn: 0,
        actedThisTurn: false,
        movedThisTurn: false
    };
};

const assessSparkCandidate = (
    actorBefore: Actor,
    actorAfterAction: Actor,
    actionType: GenericAiAction['type'],
    actionPreview: ReturnType<typeof previewActionOutcome> | undefined,
    endTurnPreview: ReturnType<typeof resolveWaitPreview>,
    ruleset?: GameState['ruleset']
): AiSparkAssessment => {
    const maxSpark = Math.max(1, Number(actorBefore.ires?.maxSpark || actorAfterAction.ires?.maxSpark || 1));
    const sparkRatioBefore = Math.max(0, Number(actorBefore.ires?.spark || 0)) / maxSpark;
    const sparkBandBefore = classifyAiSparkBand(actorBefore.ires, ruleset);
    const actionCountBefore = Number(actorBefore.ires?.actionCountThisTurn || 0);
    const isFirstAction = actionCountBefore === 0;
    const isSecondAction = actionCountBefore === 1;
    const isThirdActionOrLater = actionCountBefore >= 2;

    const sparkRatioAfterAction = actionType === 'WAIT'
        ? Math.max(0, Number(endTurnPreview.turnProjection.spark.projected || actorBefore.ires?.spark || 0)) / maxSpark
        : Math.max(0, Number(actorAfterAction.ires?.spark || actorBefore.ires?.spark || 0)) / maxSpark;
    const sparkRatioIfEndedNow = actionType === 'WAIT'
        ? sparkRatioAfterAction
        : Math.max(
            0,
            Number((actorAfterAction.ires?.spark || 0) + (endTurnPreview.turnProjection.spark.delta || 0))
        ) / maxSpark;

    const afterActionIres = actionType === 'WAIT'
        ? buildProjectedIresState(
            actorBefore,
            Number(endTurnPreview.turnProjection.spark.projected || actorBefore.ires?.spark || 0),
            endTurnPreview.turnProjection.sparkStateAfter || endTurnPreview.turnProjection.stateAfter
        )
        : actorAfterAction.ires;
    const endedNowIres = actionType === 'WAIT'
        ? afterActionIres
        : buildProjectedIresState(
            actorAfterAction,
            Number((actorAfterAction.ires?.spark || 0) + (endTurnPreview.turnProjection.spark.delta || 0)),
            endTurnPreview.turnProjection.sparkStateAfter || endTurnPreview.turnProjection.stateAfter
        );

    const sparkBandAfterAction = classifyAiSparkBand(afterActionIres, ruleset);
    const sparkBandIfEndedNow = classifyAiSparkBand(endedNowIres, ruleset);

    return {
        sparkBandBefore,
        sparkBandAfterAction,
        sparkBandIfEndedNow,
        sparkRatioBefore,
        sparkRatioAfterAction,
        sparkRatioIfEndedNow,
        actionCountBefore,
        actionCountAfter: actionType === 'WAIT'
            ? 0
            : Number(actionPreview?.resourcePreview?.turnProjection.actionCountAfter || actorAfterAction.ires?.actionCountThisTurn || actionCountBefore),
        isFirstAction,
        isSecondAction,
        isThirdActionOrLater,
        wouldEnterExhausted: sparkBandBefore !== 'exhausted' && sparkBandAfterAction === 'exhausted',
        wouldActWhileExhausted: sparkBandBefore === 'exhausted',
        wouldExitRested: isRestedBand(sparkBandBefore) && !isRestedBand(sparkBandAfterAction),
        wouldPreserveRested: isRestedBand(sparkBandBefore) && isRestedBand(sparkBandAfterAction),
        wouldReenterRested: !isRestedBand(sparkBandBefore) && isRestedBand(sparkBandIfEndedNow),
        wouldDropBelowStable: isStableOrBetterBand(sparkBandBefore) && !isStableOrBetterBand(sparkBandIfEndedNow),
        wouldDropBelowCaution: !isCriticalOrWorseBand(sparkBandBefore) && isCriticalOrWorseBand(sparkBandIfEndedNow),
        fullSparkBurstWindow: sparkRatioBefore >= 0.85 && isFirstAction,
        isTrueRestTurn: actionType === 'WAIT' && !actorBefore.ires?.actedThisTurn && !actorBefore.ires?.movedThisTurn,
        projectedRecoveryIfEndedNow: Math.max(0, Number(endTurnPreview.turnProjection.spark.delta || 0)) / maxSpark
    };
};

const evaluateCandidate = (
    context: GenericUnitAiContext,
    action: GenericAiAction,
    visibleHostiles: Actor[],
    coherenceTarget: Point | undefined,
    coherenceTargetKind: GenericUnitAiCoherenceTargetKind,
    behaviorProfile: ResolvedAiBehaviorProfile
): GenericUnitAiCandidate => {
    const actorBefore = resolveActorById(context.state, context.actor.id) || context.actor;
    const intentBias = resolveIntentBias(context.strategicIntent);
    const profile = getCandidateSkillProfile(action);
    const skillAiProfile = profile?.ai;
    const breakdown: Record<string, number> = {};

    if (action.type === 'WAIT') {
        const preview = resolveWaitPreview(actorBefore, context.state.ruleset, resolveCombatPressureMode(context.state));
        const signals = getAiResourceSignals(actorBefore.ires, context.state.ruleset);
        const projectedRecoveryRatio = Math.max(0, Number(preview.turnProjection.projectedSparkRecoveryIfEndedNow || 0))
            / Math.max(1, Number(actorBefore.ires?.maxSpark || 1));
        breakdown.recovery = projectedRecoveryRatio * 14 * intentBias.defense;
        breakdown.reserve = ((1 - signals.sparkRatio) * 8 + (1 - signals.manaRatio) * 5) * intentBias.defense;
        breakdown.pacing = signals.postStablePressure * 12 * intentBias.defense;
        breakdown.redline = preview.sparkBurnOutcome === 'burn_now' ? -22 : 0;
        breakdown.objective = visibleHostiles.length === 0 && coherenceTarget ? -6 * intentBias.objective : 0;
        breakdown.idle = visibleHostiles.length > 0 ? -2 * intentBias.offense : 0;
        breakdown.exhausted = actorBefore.ires?.currentState === 'exhausted' ? 10 : 0;
        const sparkAssessment = assessSparkCandidate(
            actorBefore,
            actorBefore,
            action.type,
            undefined,
            preview,
            context.state.ruleset
        );
        const payoff = classifyCandidatePayoff({
            visibleHostileCount: visibleHostiles.length,
            directDamage: 0,
            killCount: 0,
            objectiveDelta: 0,
            intentEstimateValue: 0,
            targetRuleScore: 0,
            canDamageNow: false,
            createsThreatNextDecision: false,
            improvesObjective: false,
            usefulReposition: false,
            hasControlIntent: false,
            hasHazardIntent: false
        });
        const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
        return {
            action,
            skillId: 'WAIT',
            reasoningCode: 'GENERIC_WAIT',
            score,
            breakdown,
            facts: { ...ZERO_FACTS },
            payoff,
            sparkAssessment
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
    const afterBehaviorProfile = resolveBehaviorProfile(preview.predictedState, predictedActor);
    const coherenceAfter = resolveCoherenceTarget({
        ...context,
        state: preview.predictedState,
        actor: predictedActor
    }, visibleAfter, afterBehaviorProfile);

    const directDamage = hostilesBefore.reduce((sum, hostile) => {
        const next = hostileByIdAfter.get(hostile.id);
        return sum + Math.max(0, hostile.hp - Number(next?.hp || 0));
    }, 0);
    const killCount = hostilesBefore.filter(hostile => !hostileByIdAfter.has(hostile.id)).length;
    const selfDamage = Math.max(0, actorBefore.hp - predictedActor.hp);
    const objectiveDelta = coherenceTarget
        ? Math.max(0, hexDistance(actorBefore.position, coherenceTarget) - hexDistance(predictedActor.position, coherenceTarget))
        : 0;
    const exposureBefore = computeExposure(actorBefore.position, visibleHostiles);
    const exposureAfter = computeExposure(predictedActor.position, visibleAfter);
    const resourcePreview = preview.resourcePreview;
    const sparkRatio = Math.max(0, Number(resourcePreview?.sparkCostTotal || 0)) / Math.max(1, Number(actorBefore.ires?.maxSpark || 1));
    const manaRatio = Math.max(0, Number(resourcePreview?.manaCost || 0)) / Math.max(1, Number(actorBefore.ires?.maxMana || 1));
    const endTurnPreview = resolveWaitPreview(
        predictedActor,
        context.state.ruleset,
        resolveCombatPressureMode(preview.predictedState)
    );
    const projectedRecovery = Math.max(0, Number(endTurnPreview.turnProjection.spark.delta || 0)) / Math.max(1, Number(actorBefore.ires?.maxSpark || 1));
    const targetRuleScore = computeTargetRuleScore(target, actorBefore, visibleHostiles, coherenceTarget, profile);
    const intentEstimateValue = computeEstimatedIntentValue(action, target, visibleHostiles, coherenceTarget, profile, intentBias);
    const desiredRangeScore = computeDesiredRangeScore(predictedActor.position, coherenceAfter.point, afterBehaviorProfile);
    const persistenceScore = skillAiProfile?.persistence
        ? ((skillAiProfile.persistence.turns || 0) * 3) + (skillAiProfile.persistence.radius || 0) * 2
        : 0;
    const safeAfterUse = skillAiProfile?.preferSafeAfterUse
        ? Math.max(0, exposureBefore - exposureAfter) * 2
        : 0;
    const standingOnHazard = UnifiedTileService.getTileAt(preview.predictedState, predictedActor.position)?.traits.has('HAZARDOUS')
        ? 1
        : 0;
    const exposureWeight = isCloseRangePosture(behaviorProfile) ? 2.5 : 6;
    const exposureDelta = exposureBefore - exposureAfter;
    const previousPosition = actorBefore.previousPosition;
    const changedPosition = !hexEquals(predictedActor.position, actorBefore.position);
    const moveLikeAction = action.type === 'MOVE'
        || (action.type === 'USE_SKILL' && !!profile?.intentTags.includes('move'));
    const backtracks = !!previousPosition && changedPosition && hexEquals(predictedActor.position, previousPosition);
    const createsThreatNextDecision = !directDamage && !killCount
        ? (
            createsPersistentThreatWindow(target, visibleHostiles, profile)
            || hasImmediateDamageOption(preview.predictedState, predictedActor)
        )
        : false;
    const improvesObjective = objectiveDelta > 0;
    const reducesExposureMaterially = exposureDelta >= (isCloseRangePosture(behaviorProfile) ? 0.75 : 1.1);
    const usefulReposition = moveLikeAction && (
        directDamage > 0
        || killCount > 0
        || createsThreatNextDecision
        || objectiveDelta >= 1
        || desiredRangeScore > 0
        || exposureDelta >= 1.5
        || standingOnHazard > 0
    );
    const isLowValueMobility = moveLikeAction
        && skillId !== 'BASIC_MOVE'
        && !directDamage
        && !killCount
        && !createsThreatNextDecision
        && !improvesObjective
        && !reducesExposureMaterially;
    const isHazardSelfTrap = standingOnHazard > 0 && exposureDelta <= 0 && selfDamage > 0;
    const lastActions = (context.state.actionLog || []).slice(-2);
    const moveWaitMoveLoop = changedPosition
        && moveLikeAction
        && lastActions.length === 2
        && lastActions[0]?.type === 'MOVE'
        && lastActions[1]?.type === 'WAIT'
        && backtracks;
    const facts: GenericUnitAiCandidateFacts = {
        canDamageNow: directDamage > 0,
        canKillNow: killCount > 0,
        createsThreatNextDecision,
        improvesObjective,
        reducesExposureMaterially,
        backtracks,
        isLowValueMobility,
        isHazardSelfTrap
    };

    const turnStartPosition = getTurnStartPosition(context.state, actorBefore.id) || actorBefore.previousPosition || actorBefore.position;
    const sameTurnRetreatRejected =
        changedPosition
        && !!coherenceTarget
        && coherenceTargetKind !== 'none'
        && !behaviorProfile.sameTurnRetreatAllowed
        && (summaryLikeApproachOrEngage(context, visibleHostiles, directDamage, killCount, createsThreatNextDecision))
        && hexDistance(actorBefore.position, coherenceTarget) < hexDistance(turnStartPosition, coherenceTarget)
        && hexDistance(predictedActor.position, coherenceTarget) > hexDistance(actorBefore.position, coherenceTarget)
        && !(
            resourcePreview?.sparkBurnOutcome === 'burn_now'
            || standingOnHazard > 0
            || (exposureDelta >= 2 && ((Number(actorBefore.hp || 0) / Math.max(1, Number(actorBefore.maxHp || 1))) < 0.35))
        );

    if (sameTurnRetreatRejected) {
        return {
            action,
            skillId,
            target,
            reasoningCode: action.type === 'MOVE' ? 'BLOCKED_RETREAT_GUARD' : `BLOCKED_RETREAT_${skillId}`,
            score: Number.NEGATIVE_INFINITY,
            breakdown: {
                blocked_by_reversal_guard: -1000
            },
            facts
        };
    }

    if (skillAiProfile?.mobilityRole === 'gap_close') {
        breakdown.mobility_role = (directDamage > 0 || killCount > 0 || createsThreatNextDecision) ? 8 : -22;
    } else if (skillAiProfile?.mobilityRole === 'escape') {
        breakdown.mobility_role = (reducesExposureMaterially || standingOnHazard > 0) ? 8 : -18;
    } else if (skillAiProfile?.mobilityRole === 'reposition') {
        breakdown.mobility_role = (improvesObjective || desiredRangeScore > 0) ? 6 : -14;
    }

    breakdown.damage = directDamage * 3.4 * intentBias.offense * behaviorProfile.offenseBias;
    breakdown.kills = killCount * 18 * intentBias.offense * behaviorProfile.offenseBias;
    breakdown.objective = objectiveDelta * 3 * intentBias.objective * Math.max(0.75, behaviorProfile.commitBias);
    breakdown.targeting = targetRuleScore * 1.1;
    breakdown.intent = intentEstimateValue * Math.max(0.65, behaviorProfile.controlBias);
    breakdown.range = desiredRangeScore * Math.max(0.75, behaviorProfile.commitBias);
    breakdown.persistence = persistenceScore * intentBias.control * Math.max(0.75, behaviorProfile.controlBias);
    breakdown.exposure = (exposureBefore - exposureAfter) * exposureWeight * intentBias.defense * Math.max(0.25, behaviorProfile.selfPreservationBias);
    breakdown.safe_after = safeAfterUse;
        breakdown.self_damage = -selfDamage * 8 * intentBias.defense * Math.max(0.25, behaviorProfile.selfPreservationBias);
    breakdown.hazard = -standingOnHazard * 18 * Math.max(0.25, 1.25 - behaviorProfile.hazardTolerance);
    breakdown.spark = -sparkRatio * 10;
    breakdown.mana = -manaRatio * 8;
    breakdown.recovery = projectedRecovery * 10 * intentBias.defense;
    breakdown.burn = resourcePreview?.sparkBurnOutcome === 'burn_now'
        ? -24
        : resourcePreview?.sparkBurnOutcome === 'travel_suppressed'
            ? 6
            : 0;
    breakdown.loop_penalty = moveWaitMoveLoop ? -10 : 0;

    const sparkAssessment = assessSparkCandidate(
        actorBefore,
        predictedActor,
        action.type,
        preview,
        endTurnPreview,
        context.state.ruleset
    );
    const payoff = classifyCandidatePayoff({
        visibleHostileCount: visibleHostiles.length,
        directDamage,
        killCount,
        objectiveDelta,
        intentEstimateValue,
        targetRuleScore,
        canDamageNow: directDamage > 0,
        createsThreatNextDecision,
        improvesObjective,
        usefulReposition,
        hasControlIntent: !!profile?.intentTags.includes('control'),
        hasHazardIntent: !!profile?.intentTags.includes('hazard')
    });

    const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    return {
        action,
        skillId,
        target,
        reasoningCode: action.type === 'MOVE' ? 'GENERIC_MOVE' : `GENERIC_${skillId}`,
        score,
        breakdown,
        facts,
        payoff,
        sparkAssessment
    };
};

export const selectGenericUnitAiAction = (
    context: GenericUnitAiContext
): { selected: GenericUnitAiCandidate; candidates: GenericUnitAiCandidate[]; summary: GenericUnitAiSelectionSummary } => {
    const state = recomputeVisibility(context.state);
    const actor = resolveActorById(state, context.actor.id) || context.actor;
    const normalizedContext: GenericUnitAiContext = {
        ...context,
        state,
        actor
    };
    const localHorizon = resolveLocalHorizon(actor);
    const visibleHostiles = getVisibleOpposingActors(state, actor, context.side, localHorizon);
    const behaviorProfile = resolveBehaviorProfile(state, actor);
    const coherenceTarget = resolveCoherenceTarget(normalizedContext, visibleHostiles, behaviorProfile);
    const evaluated = buildActionCandidates(normalizedContext, visibleHostiles, coherenceTarget.point, localHorizon, behaviorProfile)
        .map(candidate => evaluateCandidate(normalizedContext, candidate, visibleHostiles, coherenceTarget.point, coherenceTarget.kind, behaviorProfile));
    const restedOpportunityMode = classifyRestedOpportunityMode(
        evaluated
            .filter(candidate => Number.isFinite(candidate.score))
            .map(candidate => ({
                actionType: candidate.action.type,
                payoff: candidate.payoff || 'non_productive',
                assessment: candidate.sparkAssessment
            }))
    );
    const hasStandardOrBetterNonExhaustingAlternative = evaluated.some(candidate =>
        Number.isFinite(candidate.score)
        && !!candidate.sparkAssessment
        && !!candidate.payoff
        && (candidate.payoff === 'big_payoff' || candidate.payoff === 'standard_payoff')
        && !candidate.sparkAssessment.wouldEnterExhausted
        && !candidate.sparkAssessment.wouldActWhileExhausted
    );
    const doctrineCandidates = evaluated.map(candidate =>
        applySparkDoctrinePass(
            candidate,
            actor,
            restedOpportunityMode,
            hasStandardOrBetterNonExhaustingAlternative,
            behaviorProfile
        )
    );
    const adjustedCandidates = applyMobilityShadowPass(doctrineCandidates);
    const legalCandidates = adjustedCandidates.filter(candidate => Number.isFinite(candidate.score));
    const signals = getAiResourceSignals(actor.ires, state.ruleset);
    const summaryBase: GenericUnitAiSelectionSummary = {
        visibleOpponentIds: visibleHostiles.map(hostile => hostile.id),
        visibleOpponentCount: visibleHostiles.length,
        attackOpportunityAvailable: legalCandidates.some(candidate => candidate.facts?.canDamageNow),
        threatOpportunityAvailable: !legalCandidates.some(candidate => candidate.facts?.canDamageNow)
            && legalCandidates.some(candidate => candidate.facts?.createsThreatNextDecision),
        engagementMode: resolveEngagementMode(actor, visibleHostiles, legalCandidates),
        coherenceTargetKind: coherenceTarget.kind,
        sameTurnRetreatRejectedCount: evaluated.filter(candidate => candidate.breakdown?.blocked_by_reversal_guard !== undefined).length,
        sparkBandBefore: classifyAiSparkBand(actor.ires, state.ruleset),
        restedOpportunityMode,
        safeSecondActionAvailable: signals.canSafelyTakeSecondAction,
        voluntaryExhaustionAttemptCount: adjustedCandidates.filter(candidate => candidate.sparkDoctrine?.voluntaryExhaustionAttempt).length,
        voluntaryExhaustionAllowedCount: adjustedCandidates.filter(candidate => candidate.sparkDoctrine?.voluntaryExhaustionAllowed).length,
        voluntaryExhaustionBlockedCount: adjustedCandidates.filter(candidate =>
            candidate.sparkDoctrine?.voluntaryExhaustionAttempt && !candidate.sparkDoctrine?.voluntaryExhaustionAllowed
        ).length,
        behaviorProfile
    };
    const candidates = adjustedCandidates.map(candidate => applyTacticalPass(candidate, summaryBase));

    const ranked = candidates
        .filter(candidate => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score || left.reasoningCode.localeCompare(right.reasoningCode));

    if (ranked.length === 0) {
        const fallback: GenericUnitAiCandidate = {
            action: { type: 'WAIT' },
            score: 0,
            skillId: 'WAIT',
            reasoningCode: 'GENERIC_WAIT_FALLBACK',
            breakdown: {},
            facts: { ...ZERO_FACTS }
        };
        return {
            selected: fallback,
            candidates: [fallback],
            summary: {
                visibleOpponentIds: [],
                visibleOpponentCount: 0,
                attackOpportunityAvailable: false,
                threatOpportunityAvailable: false,
                engagementMode: 'search',
                coherenceTargetKind: 'none',
                sameTurnRetreatRejectedCount: 0,
                sparkBandBefore: classifyAiSparkBand(actor.ires, state.ruleset),
                restedOpportunityMode: 'battery_only',
                safeSecondActionAvailable: signals.canSafelyTakeSecondAction,
                voluntaryExhaustionAttemptCount: 0,
                voluntaryExhaustionAllowedCount: 0,
                voluntaryExhaustionBlockedCount: 0,
                selectedPayoff: 'non_productive',
                selectedSparkBandAfter: classifyAiSparkBand(actor.ires, state.ruleset),
                selectedSparkBandIfEndedNow: classifyAiSparkBand(actor.ires, state.ruleset),
                selectedRestedDecision: 'none',
                selectedWaitForBandPreservation: false,
                selectedWouldEnterExhausted: false,
                selectedWouldActWhileExhausted: false,
                selectedWouldExitRested: false,
                selectedWouldPreserveRested: false,
                selectedWouldReenterRested: false,
                selectedIsTrueRestTurn: false,
                selectedActionOrdinal: Number(actor.ires?.actionCountThisTurn || 0) + 1,
                selectedOverride: 'none',
                selectedGateReason: 'none',
                behaviorProfile: resolveBehaviorProfile(state, actor)
            }
        };
    }

    const bestScore = ranked[0].score;
    const ties = ranked.filter(candidate => candidate.score === bestScore);
    const tie = seededChoiceSource.chooseIndex(ties.length, {
        seed: `${normalizedContext.simSeed}:${normalizedContext.actor.id}`,
        counter: normalizedContext.decisionCounter
    });
    const selected = ties[tie.index] || ranked[0];
    return {
        selected,
        candidates: ranked,
        summary: {
            ...summaryBase,
            selectedPayoff: selected.payoff,
            selectedSparkBandAfter: selected.sparkAssessment?.sparkBandAfterAction,
            selectedSparkBandIfEndedNow: selected.sparkAssessment?.sparkBandIfEndedNow,
            selectedRestedDecision: selected.sparkDoctrine?.restedDecision,
            selectedWaitForBandPreservation: selected.sparkDoctrine?.waitForBandPreservation,
            selectedWouldEnterExhausted: selected.sparkAssessment?.wouldEnterExhausted,
            selectedWouldActWhileExhausted: selected.sparkAssessment?.wouldActWhileExhausted,
            selectedWouldExitRested: selected.sparkAssessment?.wouldExitRested,
            selectedWouldPreserveRested: selected.sparkAssessment?.wouldPreserveRested,
            selectedWouldReenterRested: selected.sparkAssessment?.wouldReenterRested,
            selectedIsTrueRestTurn: selected.sparkAssessment?.isTrueRestTurn,
            selectedActionOrdinal: Number(actor.ires?.actionCountThisTurn || 0) + 1,
            selectedOverride: selected.sparkDoctrine?.override,
            selectedGateReason: selected.sparkDoctrine?.gateReason
        }
    };
};
