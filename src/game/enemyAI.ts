import type { Entity, Point, GameState } from './types';
import { getNeighbors, hexDistance, hexEquals, hexAdd, hexDirection } from './hex';
import { consumeRandom } from './rng';

/**
 * Get the direction from one hex to another (0-5)
 */
const getDirectionTo = (from: Point, to: Point): number => {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    // Approximate direction based on delta
    if (dq > 0 && dr === 0) return 0;
    if (dq > 0 && dr < 0) return 1;
    if (dq === 0 && dr < 0) return 2;
    if (dq < 0 && dr === 0) return 3;
    if (dq < 0 && dr > 0) return 4;
    return 5;
};

/**
 * Check if attack is from front of shield bearer
 */
export const isBlockedByShield = (enemy: Entity, attackerPos: Point): boolean => {
    if (enemy.subtype !== 'shieldBearer' || enemy.facing === undefined) return false;

    const attackDirection = getDirectionTo(enemy.position, attackerPos);
    // Shield blocks front 3 directions (facing, facing+1, facing-1)
    const diff = Math.abs(attackDirection - enemy.facing);
    return diff <= 1 || diff >= 5;
};

/**
 * Find best move toward target, avoiding blocked hexes
 */
const findBestMove = (
    enemy: Entity,
    targetPos: Point,
    state: GameState,
    preferDistance?: number
): { position: Point; state: GameState } => {
    const neighbors = getNeighbors(enemy.position);
    let candidates: Point[] = [];
    let bestScore = preferDistance !== undefined
        ? Math.abs(hexDistance(enemy.position, targetPos) - preferDistance)
        : hexDistance(enemy.position, targetPos);

    for (const n of neighbors) {
        const isWall = state.wallPositions?.some(w => hexEquals(w, n));
        const blocked = isWall ||
            state.enemies.some(e => e.id !== enemy.id && hexEquals(e.position, n)) ||
            hexEquals(n, targetPos);

        if (blocked) continue;

        const score = preferDistance !== undefined
            ? Math.abs(hexDistance(n, targetPos) - preferDistance)
            : hexDistance(n, targetPos);

        if (score < bestScore) {
            bestScore = score;
            candidates = [n];
        } else if (score === bestScore) {
            candidates.push(n);
        }
    }

    if (candidates.length === 0) {
        return { position: enemy.position, state };
    }

    if (candidates.length === 1) {
        return { position: candidates[0], state };
    }

    // Tie-breaker with RNG
    const { value, nextState } = consumeRandom(state);
    const idx = Math.floor(value * candidates.length) % candidates.length;
    return { position: candidates[idx], state: nextState };
};

/**
 * Sprinter AI: Moves 2 hexes toward player, attacks when adjacent
 */
const computeSprinterAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: { ...enemy, intent: 'Attacking!', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    // Move up to 2 times
    let curPos = enemy.position;
    let curState = state;

    for (let move = 0; move < 2; move++) {
        if (hexDistance(curPos, playerPos) <= 1) break;

        const tempEnemy = { ...enemy, position: curPos };
        const { position, state: newState } = findBestMove(tempEnemy, playerPos, curState);
        curPos = position;
        curState = newState;
    }

    const nDist = hexDistance(curPos, playerPos);
    return {
        entity: {
            ...enemy,
            position: curPos,
            intent: nDist === 1 ? 'Attacking!' : 'Charging',
            intentPosition: nDist === 1 ? { ...playerPos } : undefined
        },
        nextState: curState
    };
};

/**
 * Shield Bearer AI: Moves toward player, turns to face them, blocks frontal attacks
 */
const computeShieldBearerAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const dist = hexDistance(enemy.position, playerPos);

    // Always face the player
    const facingDir = getDirectionTo(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: { ...enemy, facing: facingDir, intent: 'Attacking!', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state);
    const nDist = hexDistance(position, playerPos);

    return {
        entity: {
            ...enemy,
            position,
            facing: getDirectionTo(position, playerPos),
            intent: nDist === 1 ? 'Attacking!' : 'Advancing',
            intentPosition: nDist === 1 ? { ...playerPos } : undefined
        },
        nextState: newState
    };
};

/**
 * Warlock AI: Teleports randomly, casts ranged spell
 */
const computeWarlockAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const dist = hexDistance(enemy.position, playerPos);
    let curState = state;

    // Check if should teleport (random chance or too close)
    const { value: teleportChance, nextState: state1 } = consumeRandom(curState);
    curState = state1;

    let newPos = enemy.position;

    if (dist <= 2 || teleportChance < 0.3) {
        // Teleport to random position 3-5 hexes away
        const { value: dirVal, nextState: state2 } = consumeRandom(curState);
        curState = state2;
        const { value: distVal, nextState: state3 } = consumeRandom(curState);
        curState = state3;

        const teleportDir = Math.floor(dirVal * 6);
        const teleportDist = 3 + Math.floor(distVal * 3);

        let candidate = enemy.position;
        for (let i = 0; i < teleportDist; i++) {
            candidate = hexAdd(candidate, hexDirection(teleportDir));
        }

        // Check if blocked
        const blocked = state.enemies.some(e => e.id !== enemy.id && hexEquals(e.position, candidate)) ||
            hexEquals(candidate, playerPos);

        if (!blocked) {
            newPos = candidate;
        }
    }

    // Cast spell if in range
    const newDist = hexDistance(newPos, playerPos);
    const canCast = newDist >= 2 && newDist <= 4;

    return {
        entity: {
            ...enemy,
            position: newPos,
            intent: canCast ? 'Casting' : 'Preparing',
            intentPosition: canCast ? { ...playerPos } : undefined
        },
        nextState: curState
    };
};

/**
 * Assassin AI: Invisible until adjacent, then strikes
 */
const computeAssassinAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: {
                ...enemy,
                isVisible: true,
                intent: 'Backstab!',
                intentPosition: { ...playerPos }
            },
            nextState: state
        };
    }

    // Move toward player (stealthily)
    const { position, state: newState } = findBestMove(enemy, playerPos, state);
    const nDist = hexDistance(position, playerPos);

    return {
        entity: {
            ...enemy,
            position,
            isVisible: nDist <= 1,
            intent: nDist === 1 ? 'Backstab!' : undefined,
            intentPosition: nDist === 1 ? { ...playerPos } : undefined
        },
        nextState: newState
    };
};

/**
 * Golem AI: Slow movement (every other turn), powerful line attack
 */
const computeGolemAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const cooldown = enemy.actionCooldown ?? 0;

    // If on cooldown, just wait
    if (cooldown > 0) {
        return {
            entity: { ...enemy, actionCooldown: cooldown - 1, intent: 'Charging Power' },
            nextState: state
        };
    }

    const dist = hexDistance(enemy.position, playerPos);

    // Line attack if in range
    if (dist >= 1 && dist <= 3) {
        return {
            entity: {
                ...enemy,
                actionCooldown: 2, // Reset cooldown
                intent: 'Smashing!',
                intentPosition: { ...playerPos }
            },
            nextState: state
        };
    }

    // Move toward player
    const { position, state: newState } = findBestMove(enemy, playerPos, state);

    return {
        entity: {
            ...enemy,
            position,
            intent: 'Lumbering',
            actionCooldown: 0
        },
        nextState: newState
    };
};

/**
 * Compute an enemy's next move/intent given the player's position and the current state.
 * Returns a new Entity instance (do not mutate input).
 */
export const computeEnemyAction = (bt: Entity, playerMovedTo: Point, state: GameState): { entity: Entity; nextState: GameState } => {
    const dist = hexDistance(bt.position, playerMovedTo);

    // Route to specialized AI based on subtype
    switch (bt.subtype) {
        case 'sprinter':
            return computeSprinterAction(bt, playerMovedTo, state);

        case 'shieldBearer':
            return computeShieldBearerAction(bt, playerMovedTo, state);

        case 'warlock':
            return computeWarlockAction(bt, playerMovedTo, state);

        case 'assassin':
            return computeAssassinAction(bt, playerMovedTo, state);

        case 'golem':
            return computeGolemAction(bt, playerMovedTo, state);

        case 'archer': {
            // Archer AI
            const isInLine = (bt.position.q === playerMovedTo.q) || (bt.position.r === playerMovedTo.r) || (bt.position.s === playerMovedTo.s);
            if (isInLine && dist > 1 && dist <= 4) {
                return {
                    entity: { ...bt, intent: 'Aiming', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state);
            const nDist = hexDistance(position, playerMovedTo);
            const canAim = (position.q === playerMovedTo.q) || (position.r === playerMovedTo.r) || (position.s === playerMovedTo.s);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: (canAim && nDist > 1) ? 'Aiming' : 'Moving',
                    intentPosition: (canAim && nDist > 1) ? { ...playerMovedTo } : undefined
                },
                nextState: newState
            };
        }

        case 'bomber': {
            // Bomber AI: Tries to stay at distance 2-3 and throw bombs
            if (dist >= 2 && dist <= 3) {
                return {
                    entity: { ...bt, intent: 'Bombing', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state, 2.5);
            const nDist = hexDistance(position, playerMovedTo);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: (nDist >= 2 && nDist <= 3) ? 'Bombing' : 'Moving',
                    intentPosition: (nDist >= 2 && nDist <= 3) ? { ...playerMovedTo } : undefined
                },
                nextState: newState
            };
        }

        default: {
            // Footman AI (default melee)
            if (dist === 1) {
                return {
                    entity: { ...bt, intent: 'Attacking!', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state);
            const nDist = hexDistance(position, playerMovedTo);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: nDist === 1 ? 'Attacking!' : 'Moving',
                    intentPosition: nDist === 1 ? { ...playerMovedTo } : undefined
                },
                nextState: newState
            };
        }
    }
};

export default computeEnemyAction;

