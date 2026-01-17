/**
 * ENEMY AI SYSTEM
 * Uses Goal 3 (Spatial Hashing / Bitmasks) for high-performance move simulations.
 * TODO: Fully migrate specialized enemy logic (Bomber/Warlock) into the Compositional Skill Framework.
 */
import type { Entity, Point, GameState } from '../types';
import { getNeighbors, hexDistance, hexEquals, hexAdd, hexDirection, isHexInRectangularGrid } from '../hex';
import { consumeRandom } from './rng';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

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
    occupiedPositions: Point[] = [],
    preferDistance?: number
): { position: Point; state: GameState } => {
    const neighbors = getNeighbors(enemy.position);
    let candidates: Point[] = [];
    let bestScore = preferDistance !== undefined
        ? Math.abs(hexDistance(enemy.position, targetPos) - preferDistance)
        : hexDistance(enemy.position, targetPos);

    for (const n of neighbors) {
        const isInBounds = isHexInRectangularGrid(n, GRID_WIDTH, GRID_HEIGHT);
        const isWall = state.wallPositions?.some((w: Point) => hexEquals(w, n));
        const isLava = state.lavaPositions?.some((l: Point) => hexEquals(l, n));
        const blocked = !isInBounds || isWall || isLava ||
            occupiedPositions.some((p: Point) => hexEquals(p, n)) ||
            state.enemies.some((e: Entity) => e.id !== enemy.id && hexEquals(e.position, n)) ||
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
const computeSprinterAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: { ...enemy, intent: 'BASIC_ATTACK', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    // Move up to 2 times
    let curPos = enemy.position;
    let curState = state;

    for (let move = 0; move < 2; move++) {
        if (hexDistance(curPos, playerPos) <= 1) break;

        const tempEnemy = { ...enemy, position: curPos };
        const { position, state: newState } = findBestMove(tempEnemy, playerPos, curState, state.occupiedCurrentTurn);
        curPos = position;
        curState = newState;
    }

    const moved = !hexEquals(curPos, enemy.position);
    return {
        entity: {
            ...enemy,
            position: curPos,
            intent: moved ? 'Moving' : 'BASIC_ATTACK',
            intentPosition: moved ? undefined : { ...playerPos }
        },
        nextState: curState,
        message: moved ? `${enemy.subtype} moves to (${curPos.q}, ${curPos.r})` : undefined
    };
};

/**
 * Shield Bearer AI: Moves toward player, turns to face them, blocks frontal attacks
 */
const computeShieldBearerAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
    const dist = hexDistance(enemy.position, playerPos);

    // Always face the player
    const facingDir = getDirectionTo(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: { ...enemy, facing: facingDir, intent: 'BASIC_ATTACK', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);

    const moved = !hexEquals(position, enemy.position);
    return {
        entity: {
            ...enemy,
            position,
            facing: moved ? getDirectionTo(enemy.position, position) : facingDir,
            intent: moved ? 'Advancing' : 'BASIC_ATTACK',
            intentPosition: moved ? undefined : { ...playerPos }
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} advances to (${position.q}, ${position.r})` : undefined
    };
};

/**
 * Warlock AI: Teleports randomly, casts ranged spell
 */
const computeWarlockAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
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

        // Check if blocked OR non-walkable
        const isInBounds = isHexInRectangularGrid(candidate, GRID_WIDTH, GRID_HEIGHT);
        const isWall = state.wallPositions?.some((w: Point) => hexEquals(w, candidate));
        const isLava = state.lavaPositions?.some((l: Point) => hexEquals(l, candidate));

        const blocked = !isInBounds || isWall || isLava ||
            state.occupiedCurrentTurn?.some((p: Point) => hexEquals(p, candidate)) ||
            state.enemies.some((e: Entity) => e.id !== enemy.id && hexEquals(e.position, candidate)) ||
            hexEquals(candidate, playerPos);

        if (!blocked) {
            newPos = candidate;
        }
    }

    const moved = !hexEquals(newPos, enemy.position);
    const newDist = hexDistance(newPos, playerPos);
    const canCast = !moved && newDist >= 2 && newDist <= 4;

    return {
        entity: {
            ...enemy,
            position: newPos,
            intent: moved ? 'Repositioning' : (canCast ? 'Casting' : 'Preparing'),
            intentPosition: canCast ? { ...playerPos } : undefined
        },
        nextState: curState,
        message: moved ? `${enemy.subtype} teleports to (${newPos.q}, ${newPos.r})` : undefined
    };
};

/**
 * Assassin AI: Invisible until adjacent, then strikes
 */
const computeAssassinAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: {
                ...enemy,
                isVisible: true,
                intent: 'BASIC_ATTACK',
                intentPosition: { ...playerPos }
            },
            nextState: state
        };
    }

    // Move toward player (stealthily)
    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);

    const moved = !hexEquals(position, enemy.position);

    return {
        entity: {
            ...enemy,
            position,
            isVisible: moved ? false : (dist <= 1),
            intent: moved ? 'Moving' : 'BASIC_ATTACK',
            intentPosition: moved ? undefined : { ...playerPos }
        },
        nextState: newState,
        message: moved ? `You hear footsteps nearby...` : undefined
    };
};

/**
 * Sentinel AI: Boss logic
 */
const computeSentinelAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist <= 5) {
        return {
            entity: { ...enemy, intent: 'SENTINEL_BLAST', intentPosition: { ...playerPos } },
            nextState: state,
            message: 'The Sentinel focuses energy...'
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    return {
        entity: { ...enemy, position, intent: 'Moving', intentPosition: undefined },
        nextState: newState
    };
};

/**
 * Golem AI: Slow movement (every other turn), powerful line attack
 */
const computeGolemAction = (enemy: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
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
                intent: 'BASIC_ATTACK', // Use basic attack for now
                intentPosition: { ...playerPos }
            },
            nextState: state
        };
    }

    // Move toward player
    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    const moved = !hexEquals(position, enemy.position);

    return {
        entity: {
            ...enemy,
            position,
            intent: moved ? 'Lumbering' : 'Waiting',
            actionCooldown: 0
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} lumbers to (${position.q}, ${position.r})` : undefined
    };
};

/**
 * Compute an enemy's next move/intent given the player's position and the current state.
 * Returns a new Entity instance (do not mutate input).
 */
export const computeEnemyAction = (bt: Entity, playerMovedTo: Point, state: GameState & { occupiedCurrentTurn?: Point[] }): { entity: Entity; nextState: GameState; message?: string } => {
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

        case 'sentinel':
            return computeSentinelAction(bt, playerMovedTo, state);

        case 'archer': {
            // Archer AI
            const isInLine = (bt.position.q === playerMovedTo.q) || (bt.position.r === playerMovedTo.r) || (bt.position.s === playerMovedTo.s);
            if (isInLine && dist > 1 && dist <= 4) {
                return {
                    entity: { ...bt, intent: 'SPEAR_THROW', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state, state.occupiedCurrentTurn);
            const moved = !hexEquals(position, bt.position);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: moved ? 'Moving' : 'Idle',
                    intentPosition: undefined
                },
                nextState: newState,
                message: moved ? `${bt.subtype} moves to (${position.q}, ${position.r})` : undefined
            };
        }

        case 'bomber': {
            // Bomber AI: Tries to stay at distance 2-3 and throw bombs
            const cooldown = bt.actionCooldown ?? 0;
            const canBomb = cooldown === 0 && dist >= 2 && dist <= 3;

            if (canBomb) {
                // Find valid bomb target (adjacent to player, not player's tile, walkable)
                const candidateTargets = getNeighbors(playerMovedTo).filter(n => {
                    const isInBounds = isHexInRectangularGrid(n, GRID_WIDTH, GRID_HEIGHT);
                    const isWall = state.wallPositions?.some((w: Point) => hexEquals(w, n));
                    const isLava = state.lavaPositions?.some((l: Point) => hexEquals(l, n));
                    return isInBounds && !isWall && !isLava && !hexEquals(n, playerMovedTo);
                });

                if (candidateTargets.length > 0) {
                    const { value, nextState } = consumeRandom(state);
                    const targetIdx = Math.floor(value * candidateTargets.length) % candidateTargets.length;
                    const bombTarget = candidateTargets[targetIdx];

                    return {
                        entity: { ...bt, intent: 'Bombing', intentPosition: bombTarget, actionCooldown: 2 },
                        nextState
                    };
                }
            }

            // Move to maintain distance 2-3
            const { position, state: newState } = findBestMove(bt, playerMovedTo, state, state.occupiedCurrentTurn, 2.5);
            const moved = !hexEquals(position, bt.position);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: moved ? 'Moving' : 'Waiting',
                    intentPosition: undefined,
                    actionCooldown: Math.max(0, cooldown - 1)
                },
                nextState: newState,
                message: moved ? `${bt.subtype} repositioning to (${position.q}, ${position.r})` : undefined
            };
        }

        default: {
            // Default melee
            if (dist === 1) {
                return {
                    entity: { ...bt, intent: 'BASIC_ATTACK', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state, state.occupiedCurrentTurn);
            const moved = !hexEquals(position, bt.position);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: moved ? 'Moving' : 'BASIC_ATTACK',
                    intentPosition: moved ? undefined : { ...playerMovedTo }
                },
                nextState: newState,
                message: moved ? `${bt.subtype} moves to (${position.q}, ${position.r})` : undefined
            };
        }
    }
};

export default computeEnemyAction;
