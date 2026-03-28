import type {
    Actor,
    AiBehaviorOverlay,
    GameState,
    Point,
    ResolvedAiBehaviorProfile,
    SkillAiProfile,
    SkillIntentTag
} from '../../types';
import { SkillRegistry } from '../../skillRegistry';
import { DEFAULT_LOADOUTS } from '../loadout';

type RangeContribution = {
    range: number | [number, number];
    weight: number;
    sourceId: string;
};

type BehaviorAnchorTarget =
    | { kind: 'none'; point?: undefined; actorId?: undefined }
    | { kind: 'anchor_actor'; point: Point; actorId: string }
    | { kind: 'anchor_point'; point: Point; actorId?: undefined };

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const normalizeRange = (range: number | [number, number]): [number, number] =>
    Array.isArray(range)
        ? [Math.max(1, Math.round(range[0])), Math.max(1, Math.round(range[1]))]
        : [Math.max(1, Math.round(range)), Math.max(1, Math.round(range))];

const BASE_PROFILE: ResolvedAiBehaviorProfile = {
    desiredRange: 1,
    offenseBias: 1,
    commitBias: 1,
    followThroughBias: 1,
    selfPreservationBias: 0.45,
    controlBias: 0.35,
    hazardTolerance: 0.55,
    sameTurnRetreatAllowed: false,
    preferDamageOverPositioning: true,
    sourceIds: ['base:universal_default'],
    hasDirectDamagePlan: true
};

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(enemy => enemy.id === actorId) || state.companions?.find(companion => companion.id === actorId);
};

const addNumericDelta = (
    current: ResolvedAiBehaviorProfile,
    overlay: Partial<ResolvedAiBehaviorProfile>,
    scale: number
): ResolvedAiBehaviorProfile => ({
    ...current,
    offenseBias: overlay.offenseBias !== undefined ? current.offenseBias + overlay.offenseBias * scale : current.offenseBias,
    commitBias: overlay.commitBias !== undefined ? current.commitBias + overlay.commitBias * scale : current.commitBias,
    followThroughBias: overlay.followThroughBias !== undefined ? current.followThroughBias + overlay.followThroughBias * scale : current.followThroughBias,
    selfPreservationBias: overlay.selfPreservationBias !== undefined
        ? current.selfPreservationBias + overlay.selfPreservationBias * scale
        : current.selfPreservationBias,
    controlBias: overlay.controlBias !== undefined ? current.controlBias + overlay.controlBias * scale : current.controlBias,
    hazardTolerance: overlay.hazardTolerance !== undefined ? current.hazardTolerance + overlay.hazardTolerance * scale : current.hazardTolerance,
});

const applyOverlay = (
    current: ResolvedAiBehaviorProfile,
    overlay: AiBehaviorOverlay | Partial<ResolvedAiBehaviorProfile> | undefined,
    sourceId: string,
    scale: number
): ResolvedAiBehaviorProfile => {
    if (!overlay) return current;
    let next = addNumericDelta(current, overlay, scale);
    if (overlay.sameTurnRetreatAllowed !== undefined) {
        next = { ...next, sameTurnRetreatAllowed: overlay.sameTurnRetreatAllowed };
    }
    if (overlay.preferDamageOverPositioning !== undefined) {
        next = { ...next, preferDamageOverPositioning: overlay.preferDamageOverPositioning };
    }
    if (next.sourceIds[next.sourceIds.length - 1] !== sourceId) {
        next = { ...next, sourceIds: [...next.sourceIds, sourceId] };
    }
    return next;
};

const resolveSkillTags = (skillId: string): SkillIntentTag[] => {
    const profile = SkillRegistry.get(skillId)?.intentProfile;
    return profile?.intentTags || [];
};

const isTurnConsumingSkill = (skillId: string): boolean => {
    const def = SkillRegistry.get(skillId);
    if (!def) return false;
    if (skillId === 'BASIC_ATTACK') return true;
    if (def.slot === 'passive') return false;
    if (def.intentProfile?.economy?.consumesTurn === false) return false;
    return true;
};

const hasDirectDamageSkillPath = (actor: Actor): boolean =>
    (actor.activeSkills || []).some(skill =>
        isTurnConsumingSkill(String(skill.id))
        && resolveSkillTags(String(skill.id)).includes('damage')
    );

const buildSkillRangeContribution = (
    skillId: string,
    ai: SkillAiProfile | undefined,
    sourceId: string,
    scale: number
): RangeContribution | null => {
    const def = SkillRegistry.get(skillId);
    if (!def) return null;

    const explicitRange = ai?.desiredRange;
    const rangeModel = ai?.rangeModel;
    const rangeWeight = (ai?.rangeWeight ?? 1) * scale;
    const skillRange = Math.max(0, Number(def.baseVariables.range || 0));
    const tags = resolveSkillTags(skillId);

    if (explicitRange !== undefined) {
        return { range: explicitRange, weight: rangeWeight, sourceId };
    }

    switch (rangeModel) {
        case 'skill_range_plus_one':
            return { range: Math.max(1, skillRange + 1), weight: rangeWeight, sourceId };
        case 'skill_range':
            if (skillRange <= 1) return { range: 1, weight: rangeWeight, sourceId };
            return {
                range: [Math.max(1, skillRange - 1), Math.max(1, skillRange)],
                weight: rangeWeight,
                sourceId
            };
        case 'owner_proximity':
        case 'anchor_proximity':
            return { range: 1, weight: rangeWeight, sourceId };
        case 'none':
            return null;
        case 'explicit':
            return explicitRange !== undefined ? { range: explicitRange, weight: rangeWeight, sourceId } : null;
        default:
            break;
    }

    if (!isTurnConsumingSkill(skillId)) return null;
    if (!tags.some(tag => tag === 'damage' || tag === 'control' || tag === 'hazard' || tag === 'heal' || tag === 'protect')) {
        return null;
    }
    if (skillRange <= 1) return { range: 1, weight: rangeWeight, sourceId };
    return {
        range: [Math.max(1, skillRange - 1), skillRange],
        weight: rangeWeight,
        sourceId
    };
};

const buildOverlayRangeContribution = (
    overlay: AiBehaviorOverlay,
    sourceId: string,
    scale: number
): RangeContribution | null => {
    const rangeWeight = (overlay.rangeWeight ?? 1) * scale;
    if (overlay.desiredRange !== undefined) {
        return { range: overlay.desiredRange, weight: rangeWeight, sourceId };
    }
    switch (overlay.rangeModel) {
        case 'owner_proximity':
        case 'anchor_proximity':
            return { range: 1, weight: rangeWeight, sourceId };
        default:
            return null;
    }
};

const selectDesiredRange = (contributions: RangeContribution[]): number | [number, number] => {
    if (contributions.length === 0) return 1;
    const scored = new Map<string, { weight: number; range: [number, number] }>();
    for (const contribution of contributions) {
        const normalized = normalizeRange(contribution.range);
        const key = `${normalized[0]}:${normalized[1]}`;
        const current = scored.get(key);
        if (current) {
            current.weight += contribution.weight;
        } else {
            scored.set(key, {
                weight: contribution.weight,
                range: normalized
            });
        }
    }

    const ranked = [...scored.values()].sort((left, right) =>
        right.weight - left.weight
        || (left.range[0] + left.range[1]) - (right.range[0] + right.range[1])
        || left.range[0] - right.range[0]
    );
    const [min, max] = ranked[0]?.range || [1, 1];
    return min === max ? min : [min, max];
};

export const resolveBehaviorAnchorTarget = (
    state: GameState,
    actor: Actor
): BehaviorAnchorTarget => {
    const anchorActorId = actor.behaviorState?.anchorActorId;
    if (anchorActorId) {
        const anchorActor = resolveActorById(state, anchorActorId);
        if (anchorActor && anchorActor.hp > 0) {
            return {
                kind: 'anchor_actor',
                actorId: anchorActor.id,
                point: anchorActor.position
            };
        }
    }

    if (actor.behaviorState?.anchorPoint) {
        return {
            kind: 'anchor_point',
            point: actor.behaviorState.anchorPoint
        };
    }

    return { kind: 'none' };
};

export const resolveBehaviorProfile = (
    _state: GameState,
    actor: Actor
): ResolvedAiBehaviorProfile => {
    let resolved: ResolvedAiBehaviorProfile = {
        ...BASE_PROFILE,
        desiredRange: Array.isArray(BASE_PROFILE.desiredRange)
            ? [...BASE_PROFILE.desiredRange]
            : BASE_PROFILE.desiredRange
    };
    const rangeContributions: RangeContribution[] = [{
        range: 1,
        weight: 1,
        sourceId: 'base:universal_default'
    }];
    const hasDirectDamagePlan = hasDirectDamageSkillPath(actor);

    const loadout = actor.archetype ? DEFAULT_LOADOUTS[String(actor.archetype)] : undefined;
    if (loadout?.behaviorOverlay) {
        resolved = applyOverlay(resolved, loadout.behaviorOverlay, `loadout:${loadout.id}`, 1);
        const contribution = buildOverlayRangeContribution(loadout.behaviorOverlay, `loadout:${loadout.id}`, 1);
        if (contribution) rangeContributions.push(contribution);
    }

    for (const skill of actor.activeSkills || []) {
        const def = SkillRegistry.get(String(skill.id));
        const ai = def?.intentProfile?.ai;
        if (ai?.behaviorDelta) {
            resolved = applyOverlay(resolved, ai.behaviorDelta, `skill_static:${skill.id}`, 0.35);
        }
        const contribution = buildSkillRangeContribution(String(skill.id), ai, `skill_static:${skill.id}`, 0.35);
        if (contribution) rangeContributions.push(contribution);
    }

    for (const skill of actor.activeSkills || []) {
        if ((skill.currentCooldown || 0) > 0) continue;
        const def = SkillRegistry.get(String(skill.id));
        const ai = def?.intentProfile?.ai;
        if (ai?.behaviorDelta) {
            resolved = applyOverlay(resolved, ai.behaviorDelta, `skill_ready:${skill.id}`, 1);
        }
        const contribution = buildSkillRangeContribution(String(skill.id), ai, `skill_ready:${skill.id}`, 1);
        if (contribution) rangeContributions.push(contribution);
    }

    for (const overlay of actor.behaviorState?.overlays || []) {
        resolved = applyOverlay(resolved, overlay, `${overlay.source}:${overlay.sourceId}`, 1);
        const contribution = buildOverlayRangeContribution(overlay, `${overlay.source}:${overlay.sourceId}`, 2);
        if (contribution) rangeContributions.push(contribution);
    }

    if (!hasDirectDamagePlan) {
        resolved = applyOverlay(resolved, {
            offenseBias: -0.4,
            commitBias: -0.3,
            followThroughBias: -0.2,
            selfPreservationBias: 0.2,
            controlBias: 0.55,
            preferDamageOverPositioning: false
        }, 'capability:no_direct_damage', 1);
    }

    resolved = {
        ...resolved,
        desiredRange: selectDesiredRange(rangeContributions),
        offenseBias: clamp(resolved.offenseBias, 0, 2),
        commitBias: clamp(resolved.commitBias, 0, 2),
        followThroughBias: clamp(resolved.followThroughBias, 0, 2),
        selfPreservationBias: clamp(resolved.selfPreservationBias, 0, 2),
        controlBias: clamp(resolved.controlBias, 0, 2),
        hazardTolerance: clamp(resolved.hazardTolerance, 0, 2),
        hasDirectDamagePlan
    };

    return resolved;
};

export const UNIVERSAL_DEFAULT_BEHAVIOR_PROFILE = BASE_PROFILE;
