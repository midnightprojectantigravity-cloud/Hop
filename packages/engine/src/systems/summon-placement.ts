import type { Actor, AtomicEffect, GameState, Point } from '../types';
import { getNeighbors, hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { UnifiedTileService } from './tiles/unified-tile-service';

export type SummonPlacementPolicy = 'fail' | 'push_friendly';

export interface SummonPlacementResult {
    ok: boolean;
    spawnPosition?: Point;
    effects: AtomicEffect[];
    messages: string[];
    failureMessage?: string;
}

const inBounds = (state: GameState, p: Point): boolean =>
    p.q >= 0 && p.q < state.gridWidth && p.r >= 0 && p.r < state.gridHeight;

const findPushDestination = (state: GameState, summoner: Actor, origin: Point): Point | null => {
    const options = getNeighbors(origin)
        .filter(p => inBounds(state, p))
        .filter(p => UnifiedTileService.isWalkable(state, p))
        .filter(p => !getActorAt(state, p))
        .sort((a, b) => {
            const da = hexDistance(a, summoner.position);
            const db = hexDistance(b, summoner.position);
            if (da !== db) return da - db;
            if (a.q !== b.q) return a.q - b.q;
            return a.r - b.r;
        });
    return options[0] || null;
};

const canPushFriendly = (summoner: Actor, occupant: Actor): boolean =>
    occupant.id !== summoner.id && occupant.factionId === summoner.factionId;

export function resolveSummonPlacement(
    state: GameState,
    summoner: Actor,
    target: Point,
    policy: SummonPlacementPolicy = 'fail'
): SummonPlacementResult {
    const occupant = getActorAt(state, target) as Actor | undefined;
    if (!occupant) {
        return {
            ok: true,
            spawnPosition: target,
            effects: [],
            messages: [],
        };
    }

    if (policy === 'push_friendly') {
        if (!canPushFriendly(summoner, occupant)) {
            return {
                ok: false,
                effects: [],
                messages: [],
                failureMessage: 'Target tile occupied.',
            };
        }

        const pushDestination = findPushDestination(state, summoner, target);
        if (!pushDestination) {
            return {
                ok: false,
                effects: [],
                messages: [],
                failureMessage: 'No space to reposition ally.',
            };
        }

        return {
            ok: true,
            spawnPosition: target,
            effects: [{
                type: 'Displacement',
                target: occupant.id,
                destination: pushDestination,
                source: occupant.position,
                simulatePath: true,
            }],
            messages: ['Ally repositions to make room.'],
        };
    }

    return {
        ok: false,
        effects: [],
        messages: [],
        failureMessage: 'Target tile occupied.',
    };
}

