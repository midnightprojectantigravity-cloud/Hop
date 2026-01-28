import type { GameState, Point } from '../types';
import { hexAdd, DIRECTIONS, hexEquals, scaleVector, createHex } from '../hex';
import { isWithinBounds, getActorAt } from '../helpers';

export interface SearchOptions {
    range: number;
    axialOnly?: boolean;
    stopAtObstacles?: boolean;
    ignoreUnits?: boolean;
}

/**
 * Navigation System
 * Handles grid queries and pathfinding validation.
 */
export function getReachableHexes(state: GameState, origin: Point, options: SearchOptions): Point[] {
    const reachable: Point[] = [];

    if (options.axialOnly) {
        // Linear/Axial Search
        for (let d = 0; d < 6; d++) {
            const dirVec = DIRECTIONS[d];
            for (let dist = 1; dist <= options.range; dist++) {
                const current = hexAdd(origin, {
                    q: dirVec.q * dist,
                    r: dirVec.r * dist,
                    s: dirVec.s * dist
                });

                // 1. Map Bounds Check
                if (!isWithinBounds(state, current)) break;

                // 2. Obstacle Check (Walls)
                if (options.stopAtObstacles && state.wallPositions.some(w => hexEquals(w, current))) {
                    break;
                }

                // 3. Unit Check
                if (!options.ignoreUnits) {
                    const actor = getActorAt(state, current);
                    if (actor) {
                        // In some modes we might want to include the unit tile but stop, 
                        // for Dash it usually stops BEFORE or AT the unit.
                        // For now, we add it and break if it's an obstacle.
                        reachable.push(current);
                        break;
                    }
                }

                reachable.push(current);
            }
        }
    } else {
        // BFS Search (Standard range-based movement)
        const queue: Array<{ p: Point; dist: number }> = [{ p: origin, dist: 0 }];
        const visited = new Set<string>();
        const key = (p: Point) => `${p.q},${p.r},${p.s}`;
        visited.add(key(origin));

        while (queue.length > 0) {
            const { p, dist } = queue.shift()!;
            if (dist >= options.range) continue;

            for (let d = 0; d < 6; d++) {
                const next = hexAdd(p, DIRECTIONS[d]);
                const nKey = key(next);

                if (visited.has(nKey)) continue;
                if (!isWithinBounds(state, next)) continue;

                if (options.stopAtObstacles && state.wallPositions.some(w => hexEquals(w, next))) {
                    visited.add(nKey);
                    continue;
                }

                if (!options.ignoreUnits && getActorAt(state, next)) {
                    visited.add(nKey);
                    // Depending on rules, we might want to allow "ending" on a unit if it's an attack,
                    // but for reachable tiles we usually mean empty tiles.
                    // For now, let's keep it simple.
                    continue;
                }

                visited.add(nKey);
                reachable.push(next);
                queue.push({ p: next, dist: dist + 1 });
            }
        }
    }

    return reachable;
}

/**
 * Enhanced axial targeting with configurable options.
 */
export function getAxialTargetsWithOptions(state: GameState, origin: Point, range: number, options: {
    includeWalls?: boolean;
    includeActors?: boolean;
    stopAtObstacles?: boolean;
} = {}): Point[] {
    const { includeWalls = false, includeActors = true, stopAtObstacles = true } = options;
    const valid: Point[] = [];

    for (let d = 0; d < 6; d++) {
        for (let i = 1; i <= range; i++) {
            const coord = hexAdd(origin, scaleVector(d, i));

            if (!isWithinBounds(state, coord)) break;

            const isWall = state.wallPositions?.some(w => hexEquals(w, coord));
            const actor = getActorAt(state, coord);

            if (isWall) {
                if (includeWalls) valid.push(coord);
                if (stopAtObstacles) break;
            } else if (actor) {
                if (includeActors) valid.push(coord);
                if (stopAtObstacles) break;
            } else {
                valid.push(coord);
            }
        }
    }

    return valid;
}

/**
 * Gets targets in a circular area (range-based).
 */
export function getAreaTargets(state: GameState, center: Point, radius: number): Point[] {
    const targets: Point[] = [];
    for (let q = -radius; q <= radius; q++) {
        for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
            const coord = hexAdd(center, createHex(q, r));
            if (isWithinBounds(state, coord)) {
                targets.push(coord);
            }
        }
    }
    return targets;
}
