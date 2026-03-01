/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 */
import type { GameState, Action, AtomicEffect } from './types';
import { INITIAL_PLAYER_STATS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { generateDungeon, generateEnemies, getFloorTheme } from './systems/map';
import { createDefaultSkills } from './skillRegistry';
import { applyEffects } from './systems/effect-engine';

import { SpatialSystem } from './systems/spatial-system';
import { createCommand, createDelta } from './systems/commands';
import { buildInitiativeQueue, isPlayerTurn, startActorTurn } from './systems/initiative';
import { createEntity } from './systems/entities/entity-factory';


/**
 * Generate initial state with the new tactical arena generation
 */
import { applyLoadoutToPlayer, type Loadout, DEFAULT_LOADOUTS, ensureMobilitySkill, ensurePlayerLoadoutIntegrity } from './systems/loadout';
import { appendTaggedMessage } from './systems/engine-messages';
import { ensureTacticalDataBootstrapped } from './systems/tactical-data-bootstrap';
import { withPendingFrame } from './systems/pending-frame';
import { applyPlayerEndOfTurnRules, hydrateLoadedState } from './logic-rules';
import { resolveGameStateAction } from './logic-reducer-actions';
import { createProcessNextTurn } from './logic-turn-loop';
import { resolveAcaeRuleset, tickActorAilments } from './systems/ailments/runtime';

const ENGINE_DEBUG = typeof process !== 'undefined' && process.env?.HOP_ENGINE_DEBUG === '1';
const ENGINE_WARN = typeof process !== 'undefined' && process.env?.HOP_ENGINE_WARN === '1';
const TURN_STACK_WARN = ENGINE_DEBUG || ENGINE_WARN;

const warnTurnStackInvariant = (message: string, payload?: Record<string, unknown>) => {
    if (!TURN_STACK_WARN) return;
    if (payload) {
        console.warn(`[TURN_STACK] ${message}`, payload);
        return;
    }
    console.warn(`[TURN_STACK] ${message}`);
};

export const generateHubState = (): GameState => {
    const base = generateInitialState();
    // In the Hub we don't want to expose a fully populated tactical state.
    // Present an empty skill bar so the UI prompts the player to choose a loadout.
    return {
        ...base,
        gameStatus: 'hub',
        message: [appendTaggedMessage([], 'Welcome to the Strategic Hub. Select your loadout.', 'INFO', 'SYSTEM')[0]],
        player: {
            ...base.player,
            activeSkills: [],
        },
        // hide pickup items until a run starts
        hasSpear: false,
        hasShield: false
    };
};

export const generateInitialState = (
    floor: number = 1,
    seed?: string,
    initialSeed?: string,
    preservePlayer?: { hp: number; maxHp: number; upgrades: string[]; activeSkills?: any[] },
    loadout?: Loadout
): GameState => {
    ensureTacticalDataBootstrapped();

    // If no seed provided, we MUST generate one, but this should be rare in strict mode.
    const actualSeed = seed || String(Date.now());

    // Determine floor theme
    const theme = getFloorTheme(floor);

    // Use tactical arena generation for all floors
    const dungeon = generateDungeon(floor, actualSeed);
    // dungeon.spawnPositions is valid if we kept it in map.ts
    const enemies = generateEnemies(floor, (dungeon as any).spawnPositions || [], actualSeed);

    // Build player state (preserve HP/upgrades/skills across floors)
    const playerStats = preservePlayer ? {
        hp: preservePlayer.hp,
        maxHp: preservePlayer.maxHp,
        speed: (preservePlayer as any).speed || INITIAL_PLAYER_STATS.speed,
    } : {
        speed: INITIAL_PLAYER_STATS.speed,
    };

    const upgrades = preservePlayer?.upgrades || (loadout ? loadout.startingUpgrades : []);
    const loadoutApplied = loadout ? applyLoadoutToPlayer(loadout) : { activeSkills: createDefaultSkills(), archetype: 'VANGUARD' as const };
    const activeSkills = ensureMobilitySkill(preservePlayer?.activeSkills || loadoutApplied.activeSkills);
    const archetype = (preservePlayer as any)?.archetype || loadoutApplied.archetype;

    // Unified Tile Service: Initialized directly from dungeon
    const tiles = dungeon.tiles || new Map();

    const basePlayer = createEntity({
        id: 'player',
        type: 'player',
        position: dungeon.playerSpawn,
        hp: playerStats.hp,
        maxHp: playerStats.maxHp,
        speed: playerStats.speed,
        factionId: 'player',
        activeSkills,
        archetype,
        weightClass: 'Standard',
        components: new Map(),
    });

    const tempState: GameState = {
        turnNumber: 1,
        player: {
            ...basePlayer,
            previousPosition: dungeon.playerSpawn,
        },
        enemies: enemies.map(e => ({
            ...e,
            previousPosition: e.position,
            statusEffects: e.statusEffects || [],
            temporaryArmor: e.temporaryArmor || 0
        })),
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
        gameStatus: 'playing',
        message: floor === 1
            ? [appendTaggedMessage([], 'Welcome to the arena. Survive.', 'INFO', 'SYSTEM')[0]]
            : appendTaggedMessage((preservePlayer as any)?.message || [], `Floor ${floor} - ${theme.charAt(0).toUpperCase() + theme.slice(1)}. Be careful.`, 'INFO', 'OBJECTIVE'),

        hasSpear: true,
        stairsPosition: dungeon.stairsPosition,
        occupancyMask: [0n], // Will be refreshed below

        shrinePosition: dungeon.shrinePosition,
        shrineOptions: undefined,
        hasShield: true,
        floor,
        upgrades,
        rooms: dungeon.rooms,
        theme,

        // Command & Replay
        commandLog: [],
        undoStack: [],
        rngSeed: actualSeed,
        initialSeed: initialSeed ?? (floor === 1 ? actualSeed : undefined),
        rngCounter: 0,
        actionLog: [],

        // Score
        kills: preservePlayer ? (preservePlayer as any).kills || 0 : 0,
        environmentalKills: preservePlayer ? (preservePlayer as any).environmentalKills || 0 : 0,
        turnsSpent: preservePlayer ? (preservePlayer as any).turnsSpent || 0 : 0,
        dailyRunDate: (preservePlayer as any)?.dailyRunDate,
        runObjectives: (preservePlayer as any)?.runObjectives || [],
        hazardBreaches: (preservePlayer as any)?.hazardBreaches || 0,
        completedRun: undefined,
        combatScoreEvents: (preservePlayer as any)?.combatScoreEvents || [],

        // Juice
        dyingEntities: [],
        visualEvents: [],
        timelineEvents: [],
        intentPreview: undefined,

        // Core Systems
        initiativeQueue: undefined, // Initialized below
        tiles: tiles,
    };

    tempState.ruleset = resolveAcaeRuleset(tempState);

    tempState.initiativeQueue = buildInitiativeQueue(tempState);
    tempState.occupancyMask = SpatialSystem.refreshOccupancyMask(tempState);

    return tempState;
};

const executeStatusWindow = (
    state: GameState,
    actorId: string,
    window: 'START_OF_TURN' | 'END_OF_TURN',
    stepId?: string
): { state: GameState, messages: string[] } => {
    const actor = actorId === 'player' ? state.player : state.enemies.find(e => e.id === actorId);
    if (!actor) return { state, messages: [] };
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    actor.statusEffects.forEach(status => {
        if (status.tickWindow === window && status.onTick) {
            const result = status.onTick(actor, state);
            if (result) {
                effects.push(...result);
            }
        }
    });

    let nextState = applyEffects(state, effects, { sourceId: actorId, stepId });
    const ailmentTick = tickActorAilments(nextState, actorId, window, stepId);
    nextState = ailmentTick.state;
    messages.push(...ailmentTick.messages);
    return { state: nextState, messages };
};

export const processNextTurn = createProcessNextTurn({
    executeStatusWindow,
    withPendingFrame,
    applyPlayerEndOfTurnRules,
    warnTurnStackInvariant,
    engineDebug: ENGINE_DEBUG,
    engineWarn: ENGINE_WARN
});



export const gameReducer = (state: GameState, action: Action): GameState => {
    const normalizedPlayer = ensurePlayerLoadoutIntegrity(state.player);
    const normalizedState = normalizedPlayer === state.player
        ? state
        : { ...state, player: normalizedPlayer };

    if (normalizedState.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE' && action.type !== 'LOAD_STATE' && action.type !== 'APPLY_LOADOUT' && action.type !== 'START_RUN' && action.type !== 'EXIT_TO_HUB') return normalizedState;

    const clearedState: GameState = {
        ...normalizedState,
        isShaking: false,
        lastSpearPath: undefined,
        dyingEntities: [],
        occupiedCurrentTurn: undefined,
        visualEvents: [],
        timelineEvents: []
    };

    switch (action.type) {
        case 'LOAD_STATE': {
            return hydrateLoadedState(action.payload);
        }
        case 'RESET': {
            const currentArchetype = state.player.archetype;
            const loadoutId = currentArchetype === 'SKIRMISHER' ? 'SKIRMISHER' : 'VANGUARD';
            const loadout = DEFAULT_LOADOUTS[loadoutId];
            return generateInitialState(1, action.payload?.seed || String(Date.now()), undefined, undefined, loadout);
        }

        case 'EXIT_TO_HUB': {
            return generateHubState();
        }
    }

    if (normalizedState.gameStatus !== 'playing' && action.type !== 'SELECT_UPGRADE' && action.type !== 'APPLY_LOADOUT' && action.type !== 'START_RUN') return normalizedState;

    const command = createCommand(action, normalizedState);
    const oldState = normalizedState;

    let curState = {
        ...clearedState,
        initiativeQueue: clearedState.initiativeQueue
    };

    const resolveGameState = (s: GameState, a: Action): GameState => resolveGameStateAction(s, a, {
        processNextTurn,
        generateInitialState,
        generateHubState,
        warnTurnStackInvariant
    });

    const intermediateState = resolveGameState(curState, action);
    const delta = createDelta(oldState, intermediateState, state);
    command.delta = delta;

    return {
        ...intermediateState,
        commandLog: [...(intermediateState.commandLog || []), command],
        undoStack: [...(intermediateState.undoStack || []), delta],
        actionLog: [...(intermediateState.actionLog || []), action]
    };
};

/**
 * Legacy headless wrapper preserved for tests/integration callers.
 * Delegates to the canonical reducer while preserving the historical { newState } shape.
 */
export const applyAction = (state: GameState, action: Action): { newState: GameState } => {
    let curState = state;
    const playerActionsRequiringIdentityCapture: Action['type'][] = ['MOVE', 'WAIT', 'USE_SKILL', 'ATTACK'];

    if (playerActionsRequiringIdentityCapture.includes(action.type) && isPlayerTurn(curState)) {
        const queue = curState.initiativeQueue;
        const playerEntry = queue?.entries.find(e => e.actorId === curState.player.id);
        if (playerEntry && !playerEntry.turnStartPosition) {
            curState = {
                ...curState,
                initiativeQueue: startActorTurn(curState, curState.player)
            };
        }
    }

    return { newState: gameReducer(curState, action) };
};

export const fingerprintFromState = (state: GameState): string => {
    const p = state.player;
    const enemies = state.enemies.map(e => ({
        id: e.id,
        subtype: e.subtype,
        hp: e.hp,
        position: e.position
    })).sort((a, b) => a.id.localeCompare(b.id));

    const obj = {
        player: {
            hp: p.hp,
            maxHp: p.maxHp,
            position: p.position,
            upgrades: state.upgrades
        },
        enemies,
        floor: state.floor,
        turnNumber: state.turnNumber,
        kills: state.kills,
        rngCounter: state.rngCounter
    };

    return JSON.stringify(obj);
};
