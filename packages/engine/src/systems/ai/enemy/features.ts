import { hexDistance, hexEquals } from '../../../hex';
import type { AiDecision, AiFeatureVector } from '../core/types';
import type { EnemyAiContext, EnemyAiPolicyProfile, EnemyAiPlannedCandidate } from './types';
import { deriveEnemyDynamicIntentBias } from './personality';

export type EnemyIntentBand = 'offense' | 'positioning' | 'control' | 'defense';

const INTENT_BAND_ORDER: EnemyIntentBand[] = ['offense', 'control', 'positioning', 'defense'];

export const deriveEnemyDecisionFeatures = (context: EnemyAiContext): AiFeatureVector => {
    const dist = hexDistance(context.enemy.position, context.playerPos);
    return {
        dist_to_player: dist,
        adjacent_to_player: dist === 1 ? 1 : 0,
        hostile_hidden: (context.state.player.stealthCounter || 0) > 0 ? 1 : 0,
        enemy_hp: Number(context.enemy.hp || 0),
        enemy_action_cooldown: Number(context.enemy.actionCooldown || 0)
    };
};

const preferredRangeMatch = (
    dist: number,
    preferredRange: EnemyAiPolicyProfile['preferredRange']
): number => {
    if (preferredRange === undefined) return 0;
    if (typeof preferredRange === 'number') return dist === preferredRange ? 1 : 0;
    const [min, max] = preferredRange;
    return dist >= min && dist <= max ? 1 : 0;
};

const preferredRangeGap = (
    dist: number,
    preferredRange: EnemyAiPolicyProfile['preferredRange']
): number => {
    if (preferredRange === undefined) return 0;
    if (typeof preferredRange === 'number') return Math.abs(dist - preferredRange);
    const [min, max] = preferredRange;
    if (dist < min) return min - dist;
    if (dist > max) return dist - max;
    return 0;
};

const classifyEnemyCandidateIntent = (
    candidate: EnemyAiPlannedCandidate,
    decision: AiDecision
): EnemyIntentBand => {
    const actionType = decision.action.type;
    const skillId = String(decision.action.skillId || '').toUpperCase();
    const intent = String(candidate.planned.entity.intent || '').toUpperCase();

    if (
        intent === 'SEARCHING'
        || intent === 'PREPARING'
        || intent === 'SENTINEL_TELEGRAPH'
        || skillId === 'SENTINEL_TELEGRAPH'
    ) {
        return 'control';
    }

    if (
        actionType === 'MOVE'
        || intent === 'MOVING'
        || intent === 'ADVANCING'
        || intent === 'REPOSITIONING'
        || intent === 'LUMBERING'
    ) {
        return 'positioning';
    }

    if (actionType === 'WAIT' || intent === 'WAITING' || intent === 'IDLE') {
        return 'defense';
    }

    return 'offense';
};

const deriveEnemyIntentProfile = (
    context: EnemyAiContext,
    policy: EnemyAiPolicyProfile
): Record<EnemyIntentBand, number> => {
    const dist = hexDistance(context.enemy.position, context.playerPos);
    const subtype = policy.subtype || context.enemy.subtype || 'default';
    const rangedSubtype = subtype === 'archer' || subtype === 'warlock' || subtype === 'bomber';
    const inPreferredRange = preferredRangeMatch(dist, policy.preferredRange) === 1;
    const rangeGap = preferredRangeGap(dist, policy.preferredRange);
    const cooldown = Number(context.enemy.actionCooldown || 0);
    const playerHidden = (context.state.player.stealthCounter || 0) > 0;
    const inLineToPlayer =
        context.enemy.position.q === context.playerPos.q
        || context.enemy.position.r === context.playerPos.r
        || context.enemy.position.s === context.playerPos.s;

    let offense = 0;
    let positioning = 0;
    let control = 0;
    let defense = 0;

    if (rangedSubtype) {
        offense += inPreferredRange ? 1.25 : 0.55;
        positioning += inPreferredRange ? 0.35 : 1.15;
    } else {
        offense += dist <= 1 ? 1.5 : 0.6;
        positioning += dist > 1 ? 1.2 : 0.2;
    }

    positioning += Math.min(3, rangeGap) * 0.35;

    if (cooldown > 0) {
        defense += 0.8;
        control += 0.3;
        offense -= 0.15;
    }

    if (playerHidden) {
        control += 1.4;
        defense += 0.3;
        offense -= 0.4;
    }

    if (subtype === 'sentinel') {
        control += 1.3;
        if (dist <= 3) offense += 0.6;
    }
    if (subtype === 'warlock' || subtype === 'bomber') {
        positioning += 0.5;
    }
    if ((subtype === 'raider' || subtype === 'pouncer') && inLineToPlayer && dist >= 2 && dist <= 4) {
        control += 0.45;
        offense += 0.45;
    }

    const dynamicBias = deriveEnemyDynamicIntentBias(context, policy);
    offense += dynamicBias.offense;
    positioning += dynamicBias.positioning;
    control += dynamicBias.control;
    defense += dynamicBias.defense;

    return {
        offense: Math.max(0, offense),
        positioning: Math.max(0, positioning),
        control: Math.max(0, control),
        defense: Math.max(0, defense)
    };
};

const dominantIntentBand = (profile: Record<EnemyIntentBand, number>): EnemyIntentBand => {
    let best = INTENT_BAND_ORDER[0];
    for (const band of INTENT_BAND_ORDER) {
        if (profile[band] > profile[best]) {
            best = band;
        }
    }
    return best;
};

export const deriveEnemyCandidateFeatures = (
    context: EnemyAiContext,
    candidate: EnemyAiPlannedCandidate,
    decision: AiDecision,
    policy: EnemyAiPolicyProfile
): AiFeatureVector => {
    const base = deriveEnemyDecisionFeatures(context);
    const beforeDist = hexDistance(context.enemy.position, context.playerPos);
    const afterDist = hexDistance(candidate.planned.entity.position, context.playerPos);
    const moved = !hexEquals(candidate.planned.entity.position, context.enemy.position) ? 1 : 0;
    const actionType = decision.action.type;
    const skillId = decision.action.skillId || '';
    const cooldownDelta = Number(candidate.planned.entity.actionCooldown || 0) - Number(context.enemy.actionCooldown || 0);
    const isSentinel = policy.subtype === 'sentinel';
    const sentinelInRange = isSentinel && beforeDist <= 3;
    const sentinelTelegraphTurn = isSentinel && ((context.state.turnNumber % 2) === 0);
    const sentinelExecuteTurn = isSentinel && !sentinelTelegraphTurn;
    const isSentinelTelegraphSkill = skillId === 'SENTINEL_TELEGRAPH';
    const isSentinelBlastSkill = skillId === 'SENTINEL_BLAST';
    const inLineToPlayer = (context.enemy.position.q === context.playerPos.q)
        || (context.enemy.position.r === context.playerPos.r)
        || (context.enemy.position.s === context.playerPos.s);
    const isRaiderDash = skillId === 'DASH';
    const isPouncerHook = skillId === 'GRAPPLE_HOOK';
    const isArcherRanged = skillId === 'ARCHER_SHOT' || skillId === 'SPEAR_THROW';
    const isBomberBomb = skillId === 'BOMB_TOSS';
    const targetHex = decision.action.targetHex;
    const targetAdjacentToPlayer = targetHex ? (hexDistance(targetHex, context.playerPos) === 1 ? 1 : 0) : 0;
    const targetIsPlayerTile = targetHex ? (hexEquals(targetHex, context.playerPos) ? 1 : 0) : 0;
    const subtype = policy.subtype;

    return {
        ...base,
        candidate_pre_score: Number(candidate.preScore || 0),
        is_wait_action: actionType === 'WAIT' ? 1 : 0,
        is_move_action: actionType === 'MOVE' ? 1 : 0,
        is_attack_action: actionType === 'ATTACK' ? 1 : 0,
        is_skill_action: actionType === 'USE_SKILL' ? 1 : 0,
        moved,
        dist_before: beforeDist,
        dist_after: afterDist,
        dist_delta_toward_player: beforeDist - afterDist,
        preferred_range_match: preferredRangeMatch(afterDist, policy.preferredRange),
        has_target_hex: decision.action.targetHex ? 1 : 0,
        target_adjacent_to_player: targetAdjacentToPlayer,
        target_is_player_tile: targetIsPlayerTile,
        uses_signature_skill: (policy.subtype === 'sentinel' && (skillId === 'SENTINEL_BLAST' || skillId === 'SENTINEL_TELEGRAPH')) ? 1 : 0,
        raider_dash_window_match: (subtype === 'raider' && inLineToPlayer && beforeDist >= 2 && beforeDist <= 4 && isRaiderDash) ? 1 : 0,
        pouncer_hook_window_match: (subtype === 'pouncer' && inLineToPlayer && beforeDist >= 2 && beforeDist <= 4 && isPouncerHook) ? 1 : 0,
        archer_ranged_window_match: (subtype === 'archer' && beforeDist > 1 && isArcherRanged) ? 1 : 0,
        archer_melee_window_match: (subtype === 'archer' && beforeDist === 1 && skillId === 'BASIC_ATTACK') ? 1 : 0,
        bomber_bomb_window_match: (subtype === 'bomber' && (context.enemy.actionCooldown ?? 0) === 0 && beforeDist >= 2 && beforeDist <= 3 && isBomberBomb) ? 1 : 0,
        bomber_bomb_target_valid_shape: (subtype === 'bomber' && isBomberBomb && targetAdjacentToPlayer === 1 && targetIsPlayerTile === 0) ? 1 : 0,
        bomber_reposition_candidate: (subtype === 'bomber' && candidate.id === 'bomber-reposition') ? 1 : 0,
        sentinel_phase_telegraph_match: (sentinelInRange && sentinelTelegraphTurn && isSentinelTelegraphSkill) ? 1 : 0,
        sentinel_phase_execute_match: (sentinelInRange && sentinelExecuteTurn && isSentinelBlastSkill) ? 1 : 0,
        sentinel_phase_mismatch: (sentinelInRange && ((sentinelTelegraphTurn && isSentinelBlastSkill) || (sentinelExecuteTurn && isSentinelTelegraphSkill))) ? 1 : 0,
        cooldown_delta_positive: cooldownDelta > 0 ? 1 : 0,
        rng_consumption: Number(decision.rngConsumption || 0),
        message_present: candidate.planned.message ? 1 : 0
    };
};

export const deriveEnemyIntentLayerFeatures = (
    context: EnemyAiContext,
    candidate: EnemyAiPlannedCandidate,
    decision: AiDecision,
    policy: EnemyAiPolicyProfile
): AiFeatureVector => {
    const profile = deriveEnemyIntentProfile(context, policy);
    const selectedBand = classifyEnemyCandidateIntent(candidate, decision);
    const dominantBand = dominantIntentBand(profile);
    const dist = hexDistance(context.enemy.position, context.playerPos);
    const rangeGap = preferredRangeGap(dist, policy.preferredRange);
    const playerHidden = (context.state.player.stealthCounter || 0) > 0;

    return {
        intent_is_offense: selectedBand === 'offense' ? 1 : 0,
        intent_is_positioning: selectedBand === 'positioning' ? 1 : 0,
        intent_is_control: selectedBand === 'control' ? 1 : 0,
        intent_is_defense: selectedBand === 'defense' ? 1 : 0,
        intent_desire_offense: profile.offense,
        intent_desire_positioning: profile.positioning,
        intent_desire_control: profile.control,
        intent_desire_defense: profile.defense,
        intent_selected_desire: profile[selectedBand],
        intent_dominant_match: selectedBand === dominantBand ? 1 : 0,
        intent_preferred_range_gap: rangeGap,
        intent_player_hidden: playerHidden ? 1 : 0
    };
};
