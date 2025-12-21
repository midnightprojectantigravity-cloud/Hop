import type { Entity, Point, GameState } from './types';
import { getNeighbors, hexDistance, hexEquals } from './hex';
import { consumeRandom } from './rng';

/**
 * Compute an enemy's next move/intent given the player's position and the current state.
 * Returns a new Entity instance (do not mutate input).
 */
export const computeEnemyAction = (bt: Entity, playerMovedTo: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const dist = hexDistance(bt.position, playerMovedTo);

    let moveResult = bt;
    let curState = state;
    if (bt.subtype === 'archer') {
        // Archer AI
        const isInLine = (bt.position.q === playerMovedTo.q) || (bt.position.r === playerMovedTo.r) || (bt.position.s === playerMovedTo.s);
        if (isInLine && dist > 1 && dist <= 4) {
            moveResult = { ...bt, intent: 'Aiming', intentPosition: { ...playerMovedTo } };
        } else {
            const neighbors = getNeighbors(bt.position);
            let candidates: Point[] = [];
            let minDst = dist;
            for (const n of neighbors) {
                const d = hexDistance(n, playerMovedTo);
                const blocked = curState.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n)) || hexEquals(n, playerMovedTo);
                if (!blocked) {
                    if (d < minDst) {
                        minDst = d;
                        candidates = [n];
                    } else if (d === minDst) {
                        candidates.push(n);
                    }
                }
            }
            let bestMove = bt.position;
            if (candidates.length > 0) {
                if (candidates.length === 1) bestMove = candidates[0];
                else {
                    // tie-breaker deterministic via consumeRandom
                    const { value, nextState } = consumeRandom(curState);
                    curState = nextState;
                    const idx = Math.floor(value * candidates.length) % candidates.length;
                    bestMove = candidates[idx];
                }
            }
            const nDist = hexDistance(bestMove, playerMovedTo);
            const canAim = (bestMove.q === playerMovedTo.q) || (bestMove.r === playerMovedTo.r) || (bestMove.s === playerMovedTo.s);
            moveResult = { ...bt, position: bestMove, intent: (canAim && nDist > 1) ? 'Aiming' : 'Moving', intentPosition: (canAim && nDist > 1) ? { ...playerMovedTo } : undefined };
        }
    } else if (bt.subtype === 'bomber') {
        // Bomber AI: Tries to stay at distance 2-3 and throw bombs
        if (dist >= 2 && dist <= 3) {
            moveResult = { ...bt, intent: 'Bombing', intentPosition: { ...playerMovedTo } };
        } else {
            const neighbors = getNeighbors(bt.position);
            let candidates: Point[] = [];
            let minScore = Math.abs(dist - 2.5); // Bomber prefers distance 2 or 3
            for (const n of neighbors) {
                const d = hexDistance(n, playerMovedTo);
                const score = Math.abs(d - 2.5);
                const blocked = curState.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n)) || hexEquals(n, playerMovedTo);
                if (!blocked) {
                    if (score < minScore) {
                        minScore = score;
                        candidates = [n];
                    } else if (score === minScore) {
                        candidates.push(n);
                    }
                }
            }
            let bestMove = bt.position;
            if (candidates.length > 0) {
                if (candidates.length === 1) bestMove = candidates[0];
                else {
                    const { value, nextState } = consumeRandom(curState);
                    curState = nextState;
                    const idx = Math.floor(value * candidates.length) % candidates.length;
                    bestMove = candidates[idx];
                }
            }
            const nDist = hexDistance(bestMove, playerMovedTo);
            moveResult = { ...bt, position: bestMove, intent: (nDist >= 2 && nDist <= 3) ? 'Bombing' : 'Moving', intentPosition: (nDist >= 2 && nDist <= 3) ? { ...playerMovedTo } : undefined };
        }
    } else {
        // Footman AI
        if (dist === 1) {
            moveResult = { ...bt, intent: 'Attacking!', intentPosition: { ...playerMovedTo } };
        } else {
            const neighbors = getNeighbors(bt.position);
            let candidates: Point[] = [];
            let minDst = dist;
            for (const n of neighbors) {
                const d = hexDistance(n, playerMovedTo);
                const blocked = curState.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n)) || hexEquals(n, playerMovedTo);
                if (!blocked) {
                    if (d < minDst) {
                        minDst = d;
                        candidates = [n];
                    } else if (d === minDst) {
                        candidates.push(n);
                    }
                }
            }
            let bestMove = bt.position;
            if (candidates.length > 0) {
                if (candidates.length === 1) bestMove = candidates[0];
                else {
                    const { value, nextState } = consumeRandom(curState);
                    curState = nextState;
                    const idx = Math.floor(value * candidates.length) % candidates.length;
                    bestMove = candidates[idx];
                }
            }
            const nDist = hexDistance(bestMove, playerMovedTo);
            moveResult = { ...bt, position: bestMove, intent: nDist === 1 ? 'Attacking!' : 'Moving', intentPosition: nDist === 1 ? { ...playerMovedTo } : undefined };
        }
    }

    return { entity: moveResult, nextState: curState };
};

export default computeEnemyAction;
