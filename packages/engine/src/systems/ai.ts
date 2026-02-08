/**
 * ENEMY AI SYSTEM
 * Uses Goal 3 (Spatial Hashing / Bitmasks) for high-performance move simulations.
 * TODO: Fully migrate specialized enemy logic (Bomber/Warlock) into the Compositional Skill Framework.
 */
import type { Entity, Point, GameState } from '../types';
import { hexDistance, hexEquals, hexAdd, hexDirection } from '../hex';
import { consumeRandom } from './rng';
import { isRooted, isStunned } from './status';
import { TileResolver } from './tile-effects';
import { pointToKey } from '../hex';
import { SpatialSystem } from './SpatialSystem';
import { UnifiedTileService } from './unified-tile-service';


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
    // Rooted Check: Cannot move if rooted
    if (isRooted(enemy)) {
        return { position: enemy.position, state };
    }

    const neighbors = SpatialSystem.getNeighbors(enemy.position);
    let candidates: Point[] = [];
    let bestScore = preferDistance !== undefined
        ? Math.abs(hexDistance(enemy.position, targetPos) - preferDistance)
        : hexDistance(enemy.position, targetPos);

    for (const n of neighbors) {
        // 1. Boundary Check
        if (!SpatialSystem.isWithinBounds(state, n)) continue;

        const tile = state.tiles.get(pointToKey(n));

        // 2. Blocking Logic (Environment)
        const blockedByEnvironment =
            tile?.traits.has('BLOCKS_LOS') ||
            tile?.baseId === 'WALL';

        // 3. Blocking Logic (Actors)
        const blockedByActors = occupiedPositions.some((p: Point) => hexEquals(p, n)) ||
            state.enemies.some((e: Entity) => e.id !== enemy.id && hexEquals(e.position, n)) ||
            hexEquals(n, targetPos);

        if (blockedByEnvironment || blockedByActors) continue;

        // Pathfinding Cost
        const tileCost = tile ? TileResolver.getMovementCost(state, tile) : 1;
        const distScore = preferDistance !== undefined
            ? Math.abs(hexDistance(n, targetPos) - preferDistance)
            : hexDistance(n, targetPos);

        // Combine distance score with tile cost penalty
        const score = distScore + (tileCost - 1);


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
        const blocked = !SpatialSystem.isWithinBounds(state, candidate) ||
            !UnifiedTileService.isWalkable(state, candidate) ||
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
type PlaylistSpec = {
    telegraphSkillId: string;
    executeSkillId: string;
    triggerRange: number;
    telegraphMessage: string;
};

const PLAYLIST_SPECS: Record<string, PlaylistSpec> = {
    sentinel: {
        telegraphSkillId: 'SENTINEL_TELEGRAPH',
        executeSkillId: 'SENTINEL_BLAST',
        triggerRange: 3,
        telegraphMessage: 'The Sentinel marks the blast zone...'
    }
};

const computePlaylistAction = (
    enemy: Entity,
    playerPos: Point,
    state: GameState,
    spec: PlaylistSpec
): { entity: Entity; nextState: GameState; message?: string } => {
    const dist = hexDistance(enemy.position, playerPos);
    const inRange = dist <= spec.triggerRange;
    const telegraphTurn = (state.turnNumber % 2) === 0;
    const executeTurn = !telegraphTurn;

    if (inRange && executeTurn && isStunned(enemy)) {
        return {
            entity: { ...enemy, intent: 'Preparing', intentPosition: undefined },
            nextState: state,
            message: `${enemy.subtype} loses focus!`
        };
    }

    if (inRange && telegraphTurn) {
        return {
            entity: {
                ...enemy,
                intent: spec.telegraphSkillId,
                intentPosition: { ...playerPos }
            },
            nextState: state,
            message: spec.telegraphMessage
        };
    }

    if (inRange && executeTurn) {
        return {
            entity: {
                ...enemy,
                intent: spec.executeSkillId,
                intentPosition: { ...playerPos }
            },
            nextState: state
        };
    }

    // Otherwise, close distance.
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
 * Minion AI: Used by skeletons and other player-aligned summons.
 * Targets nearest enemy, but stays within 4 tiles of the player.
 */
const computeMinionAction = (minion: Entity, playerPos: Point, state: GameState): { entity: Entity; nextState: GameState; message?: string } => {
    const distToPlayer = hexDistance(minion.position, playerPos);

    // TETHER LOGIC: If too far, must return to player
    if (distToPlayer > 4) {
        const { position, state: newState } = findBestMove(minion, playerPos, state, state.occupiedCurrentTurn);
        const moved = !hexEquals(position, minion.position);
        return {
            entity: { ...minion, position, intent: moved ? 'Following' : 'Waiting' },
            nextState: newState,
            message: moved ? `${minion.subtype} follows you.` : undefined
        };
    }

    // COMBAT LOGIC: Find nearest enemy
    const nearestEnemy = state.enemies
        .filter(e => e.factionId === 'enemy')
        .sort((a, b) => hexDistance(minion.position, a.position) - hexDistance(minion.position, b.position))[0];

    if (!nearestEnemy) {
        // No enemies? Stay near player
        if (distToPlayer > 1) {
            const { position, state: newState } = findBestMove(minion, playerPos, state, state.occupiedCurrentTurn);
            return { entity: { ...minion, position, intent: 'Idle' }, nextState: newState };
        }
        return { entity: { ...minion, intent: 'Idle' }, nextState: state };
    }

    const distToEnemy = hexDistance(minion.position, nearestEnemy.position);

    if (distToEnemy === 1) {
        return {
            entity: { ...minion, intent: 'BASIC_ATTACK', intentPosition: { ...nearestEnemy.position } },
            nextState: state
        };
    }

    // Move toward enemy
    const { position, state: newState } = findBestMove(minion, nearestEnemy.position, state, state.occupiedCurrentTurn);
    const moved = !hexEquals(position, minion.position);
    const nextDist = hexDistance(position, nearestEnemy.position);

    return {
        entity: {
            ...minion,
            position,
            intent: moved ? 'Advancing' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
            intentPosition: (moved || nextDist > 1) ? undefined : { ...nearestEnemy.position }
        },
        nextState: newState,
        message: moved ? `${minion.subtype} attacks ${nearestEnemy.subtype}!` : undefined
    };
};

/**
 * Compute an enemy's next move/intent given the player's position and the current state.
 * Returns a new Entity instance (do not mutate input).
 */
export const computeEnemyAction = (bt: Entity, playerMovedTo: Point, state: GameState & { occupiedCurrentTurn?: Point[] }): { entity: Entity; nextState: GameState; message?: string } => {
    // Minion Check: If faction is player, use minion AI
    if (bt.factionId === 'player') {
        return computeMinionAction(bt, playerMovedTo, state);
    }

    // Stealth System: If player is hidden, enemies ignore them
    const isPlayerHidden = (state.player.stealthCounter || 0) > 0;
    if (isPlayerHidden) {
        return {
            entity: { ...bt, intent: 'Searching', intentPosition: undefined },
            nextState: state
        };
    }

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
            return computePlaylistAction(bt, playerMovedTo, state, PLAYLIST_SPECS.sentinel);

        case 'raider': {
            const isInLine = (bt.position.q === playerMovedTo.q) || (bt.position.r === playerMovedTo.r) || (bt.position.s === playerMovedTo.s);
            if (isInLine && dist >= 2 && dist <= 4) {
                return {
                    entity: { ...bt, intent: 'DASH', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state, state.occupiedCurrentTurn);
            const moved = !hexEquals(position, bt.position);
            const nextDist = hexDistance(position, playerMovedTo);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: moved ? 'Moving' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
                    intentPosition: (moved || nextDist > 1) ? undefined : { ...playerMovedTo }
                },
                nextState: newState,
                message: moved ? `${bt.subtype} moves to (${position.q}, ${position.r})` : undefined
            };
        }

        case 'pouncer': {
            const isInLine = (bt.position.q === playerMovedTo.q) || (bt.position.r === playerMovedTo.r) || (bt.position.s === playerMovedTo.s);
            if (isInLine && dist >= 2 && dist <= 4) {
                return {
                    entity: { ...bt, intent: 'GRAPPLE_HOOK', intentPosition: { ...playerMovedTo } },
                    nextState: state
                };
            }

            const { position, state: newState } = findBestMove(bt, playerMovedTo, state, state.occupiedCurrentTurn);
            const moved = !hexEquals(position, bt.position);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: moved ? 'Moving' : 'Waiting',
                    intentPosition: undefined
                },
                nextState: newState,
                message: moved ? `${bt.subtype} moves to (${position.q}, ${position.r})` : undefined
            };
        }

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
                const candidateTargets = SpatialSystem.getNeighbors(playerMovedTo).filter(n => {
                    const isBlocking = !UnifiedTileService.isWalkable(state, n);
                    const isOccupiedByEnemy = state.enemies.some((e: Entity) => hexEquals(e.position, n));
                    return SpatialSystem.isWithinBounds(state, n) && !isBlocking && !isOccupiedByEnemy && !hexEquals(n, playerMovedTo);
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
            const nextDist = hexDistance(position, playerMovedTo);

            return {
                entity: {
                    ...bt,
                    position,
                    intent: moved ? 'Moving' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
                    intentPosition: (moved || nextDist > 1) ? undefined : { ...playerMovedTo }
                },
                nextState: newState,
                message: moved ? `${bt.subtype} moves to (${position.q}, ${position.r})` : undefined
            };
        }
    }
};
