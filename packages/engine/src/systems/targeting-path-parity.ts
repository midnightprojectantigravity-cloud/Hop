import { hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { SkillRegistry } from '../skillRegistry';
import type { Actor, GameState, Point } from '../types';
import { previewActionOutcome, resolveMovementPreviewPath } from './action-preview';
import { SpatialSystem } from './spatial-system';
import { isFreeMoveMode } from './free-move';

export type TargetPathParityBucket =
    | 'target_invalid_but_listed'
    | 'movement_preview_missing'
    | 'execution_reject_after_valid_target'
    | 'path_interrupted_unexpected'
    | 'occupancy_or_tilehook_divergence';

export interface TargetPathParityResult {
    ok: boolean;
    bucket?: TargetPathParityBucket;
    reason?: string;
}

const MOVEMENT_SKILL_IDS = new Set(['BASIC_MOVE', 'DASH', 'JUMP']);

const resolveActorById = (state: GameState, actorId: string): Actor | undefined => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(enemy => enemy.id === actorId) || state.companions?.find(companion => companion.id === actorId);
};

const hasUniqueOccupancy = (state: GameState): boolean => {
    const occupied = new Set<string>();
    const actors: Actor[] = [state.player, ...state.enemies, ...(state.companions || [])]
        .filter(actor => actor.hp > 0);
    for (const actor of actors) {
        const key = `${actor.position.q},${actor.position.r}`;
        if (occupied.has(key)) return false;
        occupied.add(key);
    }
    return true;
};

const hasConsistentOccupancyMask = (state: GameState): boolean => {
    const refreshed = SpatialSystem.refreshOccupancyMask(state);
    if (refreshed.length !== state.occupancyMask.length) return false;
    for (let i = 0; i < refreshed.length; i++) {
        if (refreshed[i] !== state.occupancyMask[i]) return false;
    }
    return true;
};

const resolveActiveUpgradeIds = (actor: Actor, skillId: string): string[] =>
    actor.activeSkills.find(skill => skill.id === skillId)?.activeUpgrades || [];

export const isMovementSkillId = (skillId: string): boolean => MOVEMENT_SKILL_IDS.has(skillId);

export const validateSkillTargetParity = (
    state: GameState,
    actorId: string,
    skillId: string,
    target: Point
): TargetPathParityResult => {
    const actor = resolveActorById(state, actorId);
    if (!actor) {
        return { ok: false, bucket: 'target_invalid_but_listed', reason: `Actor ${actorId} not found.` };
    }

    const definition = SkillRegistry.get(skillId);
    if (!definition?.getValidTargets) {
        return { ok: false, bucket: 'target_invalid_but_listed', reason: `Skill ${skillId} has no getValidTargets.` };
    }

    const validTargets = definition.getValidTargets(state, actor.position);
    if (!validTargets.some(point => hexEquals(point, target))) {
        return {
            ok: false,
            bucket: 'target_invalid_but_listed',
            reason: `Target (${target.q}, ${target.r}, ${target.s}) is not listed by ${skillId}.`
        };
    }

    const preview = previewActionOutcome(state, {
        actorId,
        skillId,
        target,
        activeUpgrades: resolveActiveUpgradeIds(actor, skillId)
    });

    if (!preview.ok) {
        return {
            ok: false,
            bucket: 'execution_reject_after_valid_target',
            reason: preview.reason || `${skillId} preview rejected a listed target.`
        };
    }

    const hasMovementEffects = preview.effects.some(effect => effect.type === 'Displacement');
    const shouldEnforceOccupancyInvariants = hasUniqueOccupancy(state) && hasConsistentOccupancyMask(state);
    if (preview.predictedState && hasMovementEffects && shouldEnforceOccupancyInvariants) {
        if (!hasUniqueOccupancy(preview.predictedState) || !hasConsistentOccupancyMask(preview.predictedState)) {
            return {
                ok: false,
                bucket: 'occupancy_or_tilehook_divergence',
                reason: `${skillId} preview produced inconsistent occupancy state.`
            };
        }
    }

    return { ok: true };
};

export const validateMovementTargetParity = (
    state: GameState,
    actorId: string,
    skillId: 'BASIC_MOVE' | 'DASH' | 'JUMP',
    target: Point,
    options: { allowInterruptedDestination?: boolean } = {}
): TargetPathParityResult => {
    const base = validateSkillTargetParity(state, actorId, skillId, target);
    if (!base.ok) return base;

    const actor = resolveActorById(state, actorId);
    if (!actor) {
        return { ok: false, bucket: 'movement_preview_missing', reason: `Actor ${actorId} not found.` };
    }

    const movement = resolveMovementPreviewPath(state, actor, skillId, target);
    if (!movement.ok) {
        return {
            ok: false,
            bucket: 'movement_preview_missing',
            reason: movement.reason || `${skillId} did not return a movement preview path.`
        };
    }

    const allowInterruptedDestination = options.allowInterruptedDestination === true
        || (skillId === 'BASIC_MOVE' && isFreeMoveMode(state))
        || skillId === 'DASH';
    if (movement.interrupted && !allowInterruptedDestination) {
        return {
            ok: false,
            bucket: 'path_interrupted_unexpected',
            reason: `${skillId} preview interrupted before target (${target.q}, ${target.r}, ${target.s}).`
        };
    }

    if (!movement.path.length || !hexEquals(movement.path[movement.path.length - 1]!, movement.destination)) {
        return {
            ok: false,
            bucket: 'movement_preview_missing',
            reason: `${skillId} preview path destination mismatch.`
        };
    }

    const occupant = getActorAt(state, target);
    if (occupant && occupant.id !== actorId && skillId === 'BASIC_MOVE') {
        return {
            ok: false,
            bucket: 'target_invalid_but_listed',
            reason: `BASIC_MOVE target occupied by ${occupant.id}.`
        };
    }

    return { ok: true };
};
