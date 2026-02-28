import { hexAdd, hexDirection, hexDistance, hexEquals } from '../../../hex';
import { pointToKey } from '../../../hex';
import type { Entity, GameState, Point } from '../../../types';
import { consumeRandom } from '../../rng';
import { isRooted, isStunned } from '../../status';
import { TileResolver } from '../../tiles/tile-effects';
import { SpatialSystem } from '../../spatial-system';
import { UnifiedTileService } from '../../tiles/unified-tile-service';
import { SkillRegistry } from '../../../skillRegistry';
import type { EnemyAiContext, EnemyAiPolicyProfile } from './types';

export type EnemyPlannerResult = { entity: Entity; nextState: GameState; message?: string };
export type EnemyPolicyHandler = (
    enemy: Entity,
    playerPos: Point,
    state: GameState & { occupiedCurrentTurn?: Point[] }
) => EnemyPlannerResult;

const DEFAULT_ENEMY_POLICY: EnemyAiPolicyProfile = {
    id: 'enemy-default-policy-v1',
    tags: ['policy-v1']
};

const POLICY_BY_SUBTYPE: Record<string, EnemyAiPolicyProfile> = {
    sprinter: { id: 'enemy-sprinter-policy-v1', subtype: 'sprinter', preferredRange: 1, tags: ['policy-v1', 'melee'] },
    shieldBearer: { id: 'enemy-shieldBearer-policy-v1', subtype: 'shieldBearer', preferredRange: 1, tags: ['policy-v1', 'melee'] },
    warlock: { id: 'enemy-warlock-policy-v1', subtype: 'warlock', preferredRange: [2, 4], tags: ['policy-v1', 'ranged', 'teleport'] },
    sentinel: { id: 'enemy-sentinel-policy-v1', subtype: 'sentinel', preferredRange: 3, tags: ['policy-v1', 'playlist'] },
    raider: { id: 'enemy-raider-policy-v1', subtype: 'raider', preferredRange: [1, 4], tags: ['policy-v1', 'dash'] },
    pouncer: { id: 'enemy-pouncer-policy-v1', subtype: 'pouncer', preferredRange: [1, 4], tags: ['policy-v1', 'grapple'] },
    archer: { id: 'enemy-archer-policy-v1', subtype: 'archer', preferredRange: [2, 4], tags: ['policy-v1', 'ranged'] },
    bomber: { id: 'enemy-bomber-policy-v1', subtype: 'bomber', preferredRange: [2, 3], tags: ['policy-v1', 'ranged', 'aoe'] },
    assassin: { id: 'enemy-assassin-policy-v1', subtype: 'assassin', preferredRange: 1, tags: ['policy-v1', 'stealth'] },
    golem: { id: 'enemy-golem-policy-v1', subtype: 'golem', preferredRange: [1, 3], tags: ['policy-v1', 'heavy'] }
};

export const getEnemyPolicyProfile = (subtype?: string): EnemyAiPolicyProfile => {
    if (!subtype) return DEFAULT_ENEMY_POLICY;
    return POLICY_BY_SUBTYPE[subtype] || { ...DEFAULT_ENEMY_POLICY, id: `enemy-${subtype}-policy-v1`, subtype };
};

export const getDirectionTo = (from: Point, to: Point): number => {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    if (dq > 0 && dr === 0) return 0;
    if (dq > 0 && dr < 0) return 1;
    if (dq === 0 && dr < 0) return 2;
    if (dq < 0 && dr === 0) return 3;
    if (dq < 0 && dr > 0) return 4;
    return 5;
};

export const findBestMove = (
    enemy: Entity,
    targetPos: Point,
    state: GameState,
    occupiedPositions: Point[] = [],
    preferDistance?: number
): { position: Point; state: GameState } => {
    if (isRooted(enemy)) {
        return { position: enemy.position, state };
    }

    const neighbors = SpatialSystem.getNeighbors(enemy.position);
    let candidates: Point[] = [];
    let bestScore = preferDistance !== undefined
        ? Math.abs(hexDistance(enemy.position, targetPos) - preferDistance)
        : hexDistance(enemy.position, targetPos);

    for (const n of neighbors) {
        if (!SpatialSystem.isWithinBounds(state, n)) continue;

        const tile = state.tiles.get(pointToKey(n));
        const blockedByEnvironment =
            tile?.traits.has('BLOCKS_LOS') ||
            tile?.baseId === 'WALL';

        const blockedByActors = occupiedPositions.some((p: Point) => hexEquals(p, n)) ||
            state.enemies.some((e: Entity) => e.id !== enemy.id && hexEquals(e.position, n)) ||
            hexEquals(n, targetPos);

        if (blockedByEnvironment || blockedByActors) continue;

        const tileCost = tile ? TileResolver.getMovementCost(state, tile) : 1;
        const distScore = preferDistance !== undefined
            ? Math.abs(hexDistance(n, targetPos) - preferDistance)
            : hexDistance(n, targetPos);
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

    const { value, nextState } = consumeRandom(state);
    const idx = Math.floor(value * candidates.length) % candidates.length;
    return { position: candidates[idx], state: nextState };
};

const computeSprinterAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: { ...enemy, intent: 'BASIC_ATTACK', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

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

const computeShieldBearerAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);
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

const computeWarlockAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);
    let curState = state;

    const { value: teleportChance, nextState: state1 } = consumeRandom(curState);
    curState = state1;

    let newPos = enemy.position;

    if (dist <= 2 || teleportChance < 0.3) {
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

const computeAssassinAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
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
    state: GameState & { occupiedCurrentTurn?: Point[] },
    spec: PlaylistSpec
): EnemyPlannerResult => {
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

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    return {
        entity: { ...enemy, position, intent: 'Moving', intentPosition: undefined },
        nextState: newState
    };
};

const computeGolemAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const cooldown = enemy.actionCooldown ?? 0;
    if (cooldown > 0) {
        return {
            entity: { ...enemy, actionCooldown: cooldown - 1, intent: 'Charging Power' },
            nextState: state
        };
    }

    const dist = hexDistance(enemy.position, playerPos);
    if (dist >= 1 && dist <= 3) {
        return {
            entity: {
                ...enemy,
                actionCooldown: 2,
                intent: 'BASIC_ATTACK',
                intentPosition: { ...playerPos }
            },
            nextState: state
        };
    }

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

const computeMinionAction = (minion: Entity, playerPos: Point, state: GameState & { occupiedCurrentTurn?: Point[] }): EnemyPlannerResult => {
    const distToPlayer = hexDistance(minion.position, playerPos);

    if (distToPlayer > 4) {
        const { position, state: newState } = findBestMove(minion, playerPos, state, state.occupiedCurrentTurn);
        const moved = !hexEquals(position, minion.position);
        return {
            entity: { ...minion, position, intent: moved ? 'Following' : 'Waiting' },
            nextState: newState,
            message: moved ? `${minion.subtype} follows you.` : undefined
        };
    }

    const nearestEnemy = state.enemies
        .filter(e => e.factionId === 'enemy')
        .sort((a, b) => hexDistance(minion.position, a.position) - hexDistance(minion.position, b.position))[0];

    if (!nearestEnemy) {
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

const computeRaiderAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);
    const isInLine = (enemy.position.q === playerPos.q) || (enemy.position.r === playerPos.r) || (enemy.position.s === playerPos.s);
    if (isInLine && dist >= 2 && dist <= 4) {
        return {
            entity: { ...enemy, intent: 'DASH', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    const moved = !hexEquals(position, enemy.position);
    const nextDist = hexDistance(position, playerPos);

    return {
        entity: {
            ...enemy,
            position,
            intent: moved ? 'Moving' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
            intentPosition: (moved || nextDist > 1) ? undefined : { ...playerPos }
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
    };
};

const computePouncerAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);
    const isInLine = (enemy.position.q === playerPos.q) || (enemy.position.r === playerPos.r) || (enemy.position.s === playerPos.s);
    if (isInLine && dist >= 2 && dist <= 4) {
        return {
            entity: { ...enemy, intent: 'GRAPPLE_HOOK', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    const moved = !hexEquals(position, enemy.position);

    return {
        entity: {
            ...enemy,
            position,
            intent: moved ? 'Moving' : 'Waiting',
            intentPosition: undefined
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
    };
};

const computeArcherAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);
    const rangedIntentSkill = enemy.activeSkills?.some(s => s.id === 'ARCHER_SHOT')
        ? 'ARCHER_SHOT'
        : 'SPEAR_THROW';
    const rangedSkillDef = SkillRegistry.get(rangedIntentSkill);
    const canShootPlayer =
        dist > 1
        && !!rangedSkillDef?.getValidTargets
        && rangedSkillDef.getValidTargets(state, enemy.position).some(p => hexEquals(p, playerPos));

    if (canShootPlayer) {
        return {
            entity: { ...enemy, intent: rangedIntentSkill, intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    if (dist === 1 && enemy.activeSkills?.some(s => s.id === 'BASIC_ATTACK')) {
        return {
            entity: { ...enemy, intent: 'BASIC_ATTACK', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    const moved = !hexEquals(position, enemy.position);

    return {
        entity: {
            ...enemy,
            position,
            intent: moved ? 'Moving' : 'Idle',
            intentPosition: undefined
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
    };
};

const computeBomberAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);
    const cooldown = enemy.actionCooldown ?? 0;
    const canBomb = cooldown === 0 && dist >= 2 && dist <= 3;

    if (canBomb) {
        const candidateTargets = SpatialSystem.getNeighbors(playerPos).filter(n => {
            const isBlocking = !UnifiedTileService.isWalkable(state, n);
            const isOccupiedByEnemy = state.enemies.some((e: Entity) => hexEquals(e.position, n));
            return SpatialSystem.isWithinBounds(state, n) && !isBlocking && !isOccupiedByEnemy && !hexEquals(n, playerPos);
        });

        if (candidateTargets.length > 0) {
            const { value, nextState } = consumeRandom(state);
            const targetIdx = Math.floor(value * candidateTargets.length) % candidateTargets.length;
            const bombTarget = candidateTargets[targetIdx];

            return {
                entity: { ...enemy, intent: 'Bombing', intentPosition: bombTarget, actionCooldown: 2 },
                nextState
            };
        }
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn, 2.5);
    const moved = !hexEquals(position, enemy.position);

    return {
        entity: {
            ...enemy,
            position,
            intent: moved ? 'Moving' : 'Waiting',
            intentPosition: undefined,
            actionCooldown: Math.max(0, cooldown - 1)
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} repositioning to (${position.q}, ${position.r})` : undefined
    };
};

const computeDefaultEnemyAction: EnemyPolicyHandler = (enemy, playerPos, state) => {
    const dist = hexDistance(enemy.position, playerPos);

    if (dist === 1) {
        return {
            entity: { ...enemy, intent: 'BASIC_ATTACK', intentPosition: { ...playerPos } },
            nextState: state
        };
    }

    const { position, state: newState } = findBestMove(enemy, playerPos, state, state.occupiedCurrentTurn);
    const moved = !hexEquals(position, enemy.position);
    const nextDist = hexDistance(position, playerPos);

    return {
        entity: {
            ...enemy,
            position,
            intent: moved ? 'Moving' : (nextDist === 1 ? 'BASIC_ATTACK' : 'Waiting'),
            intentPosition: (moved || nextDist > 1) ? undefined : { ...playerPos }
        },
        nextState: newState,
        message: moved ? `${enemy.subtype} moves to (${position.q}, ${position.r})` : undefined
    };
};

const ENEMY_POLICY_HANDLERS: Record<string, EnemyPolicyHandler> = {
    sprinter: computeSprinterAction,
    shieldBearer: computeShieldBearerAction,
    warlock: computeWarlockAction,
    assassin: computeAssassinAction,
    golem: computeGolemAction,
    sentinel: (enemy, playerPos, state) => computePlaylistAction(enemy, playerPos, state, PLAYLIST_SPECS.sentinel),
    raider: computeRaiderAction,
    pouncer: computePouncerAction,
    archer: computeArcherAction,
    bomber: computeBomberAction
};

export const registerEnemySubtypePolicyHandler = (subtype: string, handler: EnemyPolicyHandler): void => {
    ENEMY_POLICY_HANDLERS[subtype] = handler;
};

export const planEnemyActionByPolicy = (context: EnemyAiContext): EnemyPlannerResult => {
    const { enemy, playerPos, state } = context;

    if (enemy.factionId === 'player') {
        return computeMinionAction(enemy, playerPos, state);
    }

    const isPlayerHidden = (state.player.stealthCounter || 0) > 0;
    if (isPlayerHidden) {
        return {
            entity: { ...enemy, intent: 'Searching', intentPosition: undefined },
            nextState: state
        };
    }

    const handler = enemy.subtype ? ENEMY_POLICY_HANDLERS[enemy.subtype] : undefined;
    if (handler) {
        return handler(enemy, playerPos, state);
    }

    return computeDefaultEnemyAction(enemy, playerPos, state);
};
