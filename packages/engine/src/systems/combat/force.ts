import type { AtomicEffect, GameState, Point } from '../types';
import { DIRECTIONS, hexAdd, hexEquals } from '../hex';
import { UnifiedTileService } from './unified-tile-service';

export interface ForceResolutionInput {
    source: Point;
    targetActorId: string;
    mode: 'push' | 'pull';
    magnitude: number;
    maxDistance: number;
    collision: {
        onBlocked: 'stop' | 'crush_damage';
        crushDamage?: number;
    };
    damageReason?: string;
}

export interface ForceResolutionResult {
    effects: AtomicEffect[];
    destination: Point | null;
    collided: boolean;
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

    const distance = Math.max(0, Math.min(input.maxDistance, Math.floor(input.magnitude)));
    if (distance <= 0) return { effects: [], destination: target.position, collided: false };

    const origin = target.position;
    const dir = input.mode === 'push'
        ? directionToward(input.source, origin)
        : directionToward(origin, input.source);

    const path: Point[] = [origin];
    let cursor = origin;
    let collided = false;

    for (let step = 0; step < distance; step++) {
        const next = hexAdd(cursor, dir);
        if (!UnifiedTileService.isWalkable(state, next) || isOccupiedByOtherActor(state, next, target.id)) {
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
            simulatePath: true
        });
    }

    if (collided && input.collision.onBlocked === 'crush_damage') {
        effects.push({
            type: 'Damage',
            target: target.id,
            amount: Math.max(0, Math.floor(input.collision.crushDamage ?? 0)),
            reason: input.damageReason || 'crush'
        });
    }

    return {
        effects,
        destination: cursor,
        collided
    };
};

