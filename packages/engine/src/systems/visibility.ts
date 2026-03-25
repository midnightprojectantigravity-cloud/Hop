import type {
    Actor,
    EnemyAwarenessState,
    FogOfWarState,
    GameState,
    Point,
    VisibilityState
} from '../types';
import { createHex, getHexLine, hexDirection, hexEquals, pointToKey } from '../hex';
import { resolveSenseLineOfSight } from './capabilities/senses';
import { findFirstObstacle } from './validation';
import { UnifiedTileService } from './tiles/unified-tile-service';
import {
    computeEnemyAwarenessMemoryTurns,
    computeEnemyButcherFactor
} from '../skills/enemy_awareness';

type LegacyLosOptions = {
    stopAtWalls?: boolean;
    stopAtActors?: boolean;
    stopAtLava?: boolean;
    excludeActorId?: string;
};

const EMPTY_FOG: FogOfWarState = {
    visibleTileKeys: [],
    exploredTileKeys: [],
    visibleActorIds: [],
    detectedActorIds: []
};

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

const hashId = (id: string): number => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash * 31) + id.charCodeAt(i)) >>> 0;
    }
    return hash;
};

const sortKeys = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const sortActorIds = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const computeLegacyLineOfSight = (
    state: GameState,
    origin: Point,
    target: Point,
    options: LegacyLosOptions = {}
): { isValid: boolean; blockedBy?: 'wall' | 'actor' | 'lava'; blockedAt?: Point } => {
    const line = getHexLine(origin, target);
    const pathToCheck = line.slice(1);
    const obstacle = findFirstObstacle(state, pathToCheck, {
        checkWalls: options.stopAtWalls ?? true,
        checkActors: options.stopAtActors ?? true,
        checkLava: options.stopAtLava ?? false,
        excludeActorId: options.excludeActorId
    });
    if (obstacle.obstacle && obstacle.position && !hexEquals(obstacle.position, target)) {
        return {
            isValid: false,
            blockedBy: obstacle.obstacle,
            blockedAt: obstacle.position
        };
    }
    return { isValid: true };
};

const buildObserverSenseContext = (
    state: GameState,
    observer: Actor
): Record<string, unknown> | undefined => {
    const observerTile = UnifiedTileService.getTileAt(state, observer.position);
    const smokeBlind = observerTile.effects.some(effect => effect.id === 'SMOKE' || effect.id === 'STEAM');
    const statusBlind = observer.statusEffects?.some(status => status.type === 'blinded') || false;
    if (!smokeBlind && !statusBlind) return undefined;
    return { smokeBlind, statusBlind };
};

const resolveSense = (
    state: GameState,
    observer: Actor,
    target: Point
) => resolveSenseLineOfSight({
    state,
    observer,
    origin: observer.position,
    target,
    stopAtWalls: true,
    stopAtActors: false,
    stopAtLava: false,
    excludeActorId: observer.id,
    context: buildObserverSenseContext(state, observer),
    evaluateLegacyLineOfSight: (overrides) => computeLegacyLineOfSight(state, observer.position, target, {
        stopAtWalls: overrides?.stopAtWalls,
        stopAtActors: overrides?.stopAtActors,
        stopAtLava: overrides?.stopAtLava,
        excludeActorId: overrides?.excludeActorId
    })
});

const computePlayerFog = (state: GameState): FogOfWarState => {
    const player = state.player;
    const previousExplored = new Set(state.visibility?.playerFog?.exploredTileKeys || []);
    const visibleTileKeys = new Set<string>();
    const visibleActorIds = new Set<string>();
    const detectedActorIds = new Set<string>();

    for (const tile of state.tiles.values()) {
        const result = resolveSense(state, player, tile.position);
        if (!result.isValid) continue;
        if (!result.channels.includes('standard_vision')) continue;
        visibleTileKeys.add(pointToKey(tile.position));
    }

    const subjectActors = [...state.enemies, ...(state.companions || [])]
        .filter(actor => actor.id !== player.id && actor.hp > 0);

    for (const subject of subjectActors) {
        const result = resolveSense(state, player, subject.position);
        if (!result.isValid) continue;
        detectedActorIds.add(subject.id);
        if (result.channels.includes('standard_vision')) {
            visibleActorIds.add(subject.id);
        }
    }

    visibleTileKeys.forEach(key => previousExplored.add(key));

    return {
        visibleTileKeys: sortKeys(visibleTileKeys),
        exploredTileKeys: sortKeys(previousExplored),
        visibleActorIds: sortActorIds(visibleActorIds),
        detectedActorIds: sortActorIds(detectedActorIds)
    };
};

const computeEnemyAwarenessById = (
    state: GameState,
    previous: Record<string, EnemyAwarenessState> | undefined
): Record<string, EnemyAwarenessState> => {
    const byId: Record<string, EnemyAwarenessState> = {};

    const hostiles = state.enemies
        .filter(enemy => enemy.hp > 0 && enemy.factionId !== state.player.factionId);

    for (const enemy of hostiles) {
        const prior = previous?.[enemy.id];
        const butcherFactor = computeEnemyButcherFactor(enemy);
        const memoryWindow = computeEnemyAwarenessMemoryTurns(enemy);
        const senseResult = resolveSense(state, enemy, state.player.position);
        const isDetectingPlayer = senseResult.isValid
            && senseResult.channels.includes('enemy_awareness');

        let lastKnownPlayerPosition = prior?.lastKnownPlayerPosition
            ? clonePoint(prior.lastKnownPlayerPosition)
            : null;
        let lastSeenTurn = prior?.lastSeenTurn ?? null;

        if (isDetectingPlayer) {
            lastKnownPlayerPosition = clonePoint(state.player.position);
            lastSeenTurn = state.turnNumber;
        }

        let memoryTurnsRemaining = 0;
        if (lastSeenTurn !== null) {
            const elapsedTurns = Math.max(0, state.turnNumber - lastSeenTurn);
            memoryTurnsRemaining = Math.max(0, memoryWindow - elapsedTurns);
        }

        if (!isDetectingPlayer && memoryTurnsRemaining <= 0) {
            lastKnownPlayerPosition = null;
            lastSeenTurn = null;
        }

        byId[enemy.id] = {
            enemyId: enemy.id,
            lastKnownPlayerPosition,
            lastSeenTurn,
            memoryTurnsRemaining,
            butcherFactor,
        };
    }

    return byId;
};

export const createEmptyVisibilityState = (): VisibilityState => ({
    playerFog: {
        ...EMPTY_FOG,
        visibleTileKeys: [...EMPTY_FOG.visibleTileKeys],
        exploredTileKeys: [...EMPTY_FOG.exploredTileKeys],
        visibleActorIds: [...EMPTY_FOG.visibleActorIds],
        detectedActorIds: [...EMPTY_FOG.detectedActorIds]
    },
    enemyAwarenessById: {}
});

export const recomputeVisibility = (state: GameState): GameState => {
    if (state.gameStatus !== 'playing') {
        if (!state.visibility) return { ...state, visibility: createEmptyVisibilityState() };
        return state;
    }

    const playerFog = computePlayerFog(state);
    const enemyAwarenessById = computeEnemyAwarenessById(state, state.visibility?.enemyAwarenessById);
    const nextVisibility: VisibilityState = {
        playerFog,
        enemyAwarenessById
    };

    return {
        ...state,
        visibility: nextVisibility
    };
};

// Scenario and test setup frequently reposition actors wholesale. In those cases,
// preserving prior awareness memory from an unrelated layout leaks stale alert state.
export const recomputeVisibilityFromScratch = (state: GameState): GameState =>
    recomputeVisibility({
        ...state,
        visibility: undefined
    });

export const resolveEnemyTrackingTarget = (
    state: GameState,
    enemy: Actor
): Point => {
    const awareness = state.visibility?.enemyAwarenessById?.[enemy.id];
    if (!state.visibility) {
        return clonePoint(state.player.position);
    }
    if (!awareness?.lastKnownPlayerPosition || awareness.memoryTurnsRemaining <= 0) {
        return clonePoint(enemy.position);
    }
    if (awareness.lastSeenTurn === state.turnNumber) {
        return clonePoint(awareness.lastKnownPlayerPosition);
    }

    const turnDelta = Math.max(1, state.turnNumber - (awareness.lastSeenTurn || state.turnNumber));
    const searchRadius = Math.max(2, 1 + awareness.butcherFactor);
    const step = Math.min(searchRadius, turnDelta);
    const direction = hexDirection((hashId(enemy.id) + turnDelta) % 6);
    return createHex(
        awareness.lastKnownPlayerPosition.q + (direction.q * step),
        awareness.lastKnownPlayerPosition.r + (direction.r * step)
    );
};
