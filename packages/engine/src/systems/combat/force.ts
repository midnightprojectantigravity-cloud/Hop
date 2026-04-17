import type { AtomicEffect, GameState, Point } from '../../types';
import { DIRECTIONS, hexAdd, hexEquals } from '../../hex';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { isBlockedByWall } from '../validation';
import { resolveBlockedCollisionEffects } from './collision-policy';
import { toCanonicalDistance } from './force-contract';
import { extractTrinityStats } from './combat-calculator';
import { calculateForceContest } from './force-contest';

export interface ForceResolutionInput {
    source: Point;
    targetActorId: string;
    mode: 'push' | 'pull';
    magnitude: number;
    maxDistance: number;
    collision: {
        onBlocked: 'stop' | 'crush_damage';
        crushDamage?: number;
        applyStunOnStop?: boolean;
        stunDuration?: number;
    };
    damageReason?: string;
    attackerBody?: number;
    defenderBody?: number;
    bodyContestMode?: 'strict_ratio' | 'soft_ratio';
}

export interface ForceResolutionResult {
    effects: AtomicEffect[];
    destination: Point | null;
    collided: boolean;
    bodyContestRatio?: number;
    resolvedKnockbackDistance?: number;
    recoilApplied?: boolean;
}

const findActorById = (state: GameState, actorId: string) => {
    if (state.player.id === actorId) return state.player;
    return state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
};

const isOccupiedByOtherActor = (state: GameState, position: Point, excludedId: string): boolean => {
    if (state.player.id !== excludedId && hexEquals(state.player.position, position)) return true;
    if (state.enemies.some(e => e.id !== excludedId && e.hp > 0 && hexEquals(e.position, position))) return true;
    if (state.companions?.some(e => e.id !== excludedId && e.hp > 0 && hexEquals(e.position, position))) return true;
    return false;
};

const directionToward = (from: Point, to: Point): Point => {
    const delta = { q: to.q - from.q, r: to.r - from.r, s: to.s - from.s };
    let best = DIRECTIONS[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const dir of DIRECTIONS) {
        const score = (dir.q * delta.q) + (dir.r * delta.r) + (dir.s * delta.s);
        if (score > bestScore) {
            bestScore = score;
            best = dir;
        }
    }
    return best;
};

export const resolveForce = (state: GameState, input: ForceResolutionInput): ForceResolutionResult => {
    const target = findActorById(state, input.targetActorId);
    if (!target) return { effects: [], destination: null, collided: false };

    const intendedDistance = toCanonicalDistance(input.magnitude, input.maxDistance);
    const attackerBody = Number.isFinite(input.attackerBody)
        ? Number(input.attackerBody)
        : undefined;
    const defenderBody = Number.isFinite(input.defenderBody)
        ? Number(input.defenderBody)
        : extractTrinityStats(target).body;
    const contest = attackerBody === undefined
        ? {
            bodyContestRatio: undefined,
            resolvedKnockbackDistance: intendedDistance,
            recoilApplied: false
        }
        : calculateForceContest({
            attackerBody,
            defenderBody,
            intendedDistance,
            bodyContestMode: input.bodyContestMode
        });
    const distance = contest.resolvedKnockbackDistance;
    if (distance <= 0) {
        return {
            effects: [],
            destination: target.position,
            collided: false,
            bodyContestRatio: contest.bodyContestRatio,
            resolvedKnockbackDistance: contest.resolvedKnockbackDistance,
            recoilApplied: contest.recoilApplied
        };
    }

    const origin = target.position;
    const dir = input.mode === 'push'
        ? directionToward(input.source, origin)
        : directionToward(origin, input.source);

    const path: Point[] = [origin];
    let cursor = origin;
    let collided = false;

    for (let step = 0; step < distance; step++) {
        const next = hexAdd(cursor, dir);
        const blockedByWall = isBlockedByWall(state, next)
            || UnifiedTileService.getTraitsAt(state, next).has('BLOCKS_MOVEMENT');
        if (blockedByWall || isOccupiedByOtherActor(state, next, target.id)) {
            collided = true;
            break;
        }
        path.push(next);
        cursor = next;
    }

    const effects: AtomicEffect[] = [];
    if (!hexEquals(cursor, origin)) {
        effects.push({
            type: 'Displacement',
            target: target.id,
            destination: cursor,
            path,
            simulatePath: true,
            ignoreGroundHazards: true
        });
    }

    if (collided) {
        effects.push(
            ...resolveBlockedCollisionEffects(
                target.id,
                {
                    onBlocked: input.collision.onBlocked,
                    crushDamage: input.collision.crushDamage,
                    damageReason: input.damageReason,
                    applyStunOnStop: input.collision.applyStunOnStop,
                    stunDuration: input.collision.stunDuration
                }
            )
        );
    }

    return {
        effects,
        destination: cursor,
        collided,
        bodyContestRatio: contest.bodyContestRatio,
        resolvedKnockbackDistance: contest.resolvedKnockbackDistance,
        recoilApplied: contest.recoilApplied
    };
};
