/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 */
import type { GameState, Action, AtomicEffect, GridSize, MapShape } from './types';
import type { CompiledFloorArtifact, GenerationSpecInput, GenerationState } from './generation/schema';
import { INITIAL_PLAYER_STATS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { getNeighbors } from './hex';
import { getFloorTheme } from './systems/map';
import { createDefaultSkills } from './skillRegistry';
import { applyEffects } from './systems/effect-engine';

import { SpatialSystem } from './systems/spatial-system';
import { createCommand, createDelta } from './systems/commands';
import { buildInitiativeQueue, isPlayerTurn, startActorTurn } from './systems/initiative';
import { createEntity } from './systems/entities/entity-factory';


/**
 * Generate initial state with the new tactical arena generation
 */
import {
    applyLoadoutToPlayer,
    type Loadout,
    DEFAULT_LOADOUTS,
    ensureMobilitySkill,
    ensurePlayerCoreVisionSkill,
    ensurePlayerLoadoutIntegrity,
    ensurePlayingPlayerLoadoutIntegrity
} from './systems/loadout';
import { appendTaggedMessage } from './systems/engine-messages';
import { ensureTacticalDataBootstrapped } from './systems/tactical-data-bootstrap';
import { withPendingFrame } from './systems/pending-frame';
import { applyPlayerEndOfTurnRules, hydrateLoadedState } from './logic-rules';
import { resolveGameStateAction } from './logic-reducer-actions';
import { createProcessNextTurn } from './logic-turn-loop';
import { resolveAcaeRuleset, tickActorAilments } from './systems/ailments/runtime';
import { buildIntentPreview } from './systems/telegraph-projection';
import { isReplayRecordableAction } from './systems/replay-validation';
import { recomputeVisibility } from './systems/visibility';
import { UnifiedTileService } from './systems/tiles/unified-tile-service';
import { createDailyObjectives, createDailySeed, toDateKey } from './systems/run-objectives';
import {
    compileStandaloneFloor,
    createInitialCompilerGenerationState,
    createEmptyRunTelemetry,
    rebuildEnemiesFromArtifact,
    rebuildTilesFromArtifact,
    initializeGenerationForState
} from './generation';
import { hydrateGameStateIres, resolveIresRuleset, withResolvedIresRuleset } from './systems/ires';
import { mergeCombatRulesetOverride, resolveCombatRuleset } from './systems/combat/combat-ruleset';
import { createEmptyEnemyAiRunTelemetry } from './systems/ai/enemy/runtime-telemetry';

const ENGINE_DEBUG = typeof process !== 'undefined' && process.env?.HOP_ENGINE_DEBUG === '1';
const ENGINE_WARN = typeof process !== 'undefined' && process.env?.HOP_ENGINE_WARN === '1';
const TURN_STACK_WARN = ENGINE_DEBUG || ENGINE_WARN;

const resolveRunMapConfig = (mapSize?: GridSize, mapShape?: MapShape): GridSize & { mapShape: MapShape } => {
    const width = Number(mapSize?.width);
    const height = Number(mapSize?.height);
    const resolvedMapShape: MapShape = mapShape === 'rectangle' ? 'rectangle' : 'diamond';
    const normalizedWidth = Number.isInteger(width) && width > 0 ? width : GRID_WIDTH;
    const normalizedHeight = Number.isInteger(height) && height > 0 ? height : GRID_HEIGHT;
    const widthWithShapeConstraint = resolvedMapShape === 'diamond' && normalizedWidth % 2 === 0
        ? normalizedWidth + 1
        : normalizedWidth;
    const heightWithShapeConstraint = resolvedMapShape === 'diamond' && normalizedHeight % 2 === 0
        ? normalizedHeight + 1
        : normalizedHeight;
    return {
        width: widthWithShapeConstraint,
        height: heightWithShapeConstraint,
        mapShape: resolvedMapShape
    };
};

const warnTurnStackInvariant = (message: string, payload?: Record<string, unknown>) => {
    if (!TURN_STACK_WARN) return;
    if (payload) {
        console.warn(`[TURN_STACK] ${message}`, payload);
        return;
    }
    console.warn(`[TURN_STACK] ${message}`);
};

const mergeRunRulesetOverrides = (
    base: GameState['ruleset'],
    overrides?: Record<string, any>
): GameState['ruleset'] => {
    if (!overrides) return base;
    const baseIres = resolveIresRuleset(base);
    return {
        ...mergeCombatRulesetOverride(base, overrides),
        combat: {
            version: overrides.combat?.version || resolveCombatRuleset(base)
        },
        ires: {
            ...baseIres,
            ...(overrides.ires || {}),
            fibonacciTable: [...((overrides.ires?.fibonacciTable as number[] | undefined) || baseIres.fibonacciTable)]
        }
    };
};

const finalizeArtifactAppliedState = (state: GameState): GameState => {
    const withRuleset = withResolvedIresRuleset({
        ...state,
        ruleset: resolveAcaeRuleset(state)
    });
    withRuleset.ruleset = {
        ...(withRuleset.ruleset || {}),
        combat: {
            version: resolveCombatRuleset(withRuleset)
        }
    };
    const hydrated = hydrateGameStateIres(withRuleset);
    const withInitiative = {
        ...hydrated,
        initiativeQueue: buildInitiativeQueue(hydrated),
        occupancyMask: SpatialSystem.refreshOccupancyMask(hydrated)
    };
    const withVisibility = recomputeVisibility(withInitiative);
    return {
        ...withVisibility,
        intentPreview: buildIntentPreview(withVisibility)
    };
};

const migrateCompanionsToArtifactFloor = (nextState: GameState, priorState: GameState): GameState => {
    const migratingSummons = priorState.enemies
        .filter(e => e.hp > 0 && e.factionId === 'player' && e.companionOf === priorState.player.id)
        .sort((a, b) => a.id.localeCompare(b.id));
    if (migratingSummons.length === 0) return nextState;

    const candidates = [nextState.player.position, ...getNeighbors(nextState.player.position)];
    const occupied = [nextState.player, ...nextState.enemies];
    const migrated = [];

    for (const summon of migratingSummons) {
        const fallback = candidates[candidates.length - 1] || nextState.player.position;
        const spawnPos = candidates.find(pos => {
            const unoccupied = !occupied.some(actor => actor.position.q === pos.q && actor.position.r === pos.r);
            return unoccupied && UnifiedTileService.isWalkable(nextState, pos);
        }) || fallback;
        const migratedSummon = {
            ...summon,
            position: spawnPos,
            previousPosition: spawnPos
        };
        occupied.push(migratedSummon);
        migrated.push(migratedSummon);
    }

    return {
        ...nextState,
        enemies: [...nextState.enemies, ...migrated],
        companions: [
            ...(nextState.companions || []),
            ...migrated.filter(e => e.companionOf === nextState.player.id)
        ]
    };
};

const applyCompiledFloorArtifactToState = (
    state: GameState,
    artifact: CompiledFloorArtifact
): GameState => {
    const tiles = rebuildTilesFromArtifact(artifact);
    const enemies = rebuildEnemiesFromArtifact(artifact).map(enemy => ({
        ...enemy,
        previousPosition: enemy.position,
        statusEffects: enemy.statusEffects || [],
        temporaryArmor: enemy.temporaryArmor || 0
    }));

    if (artifact.mode === 'start_run') {
        const loadoutId = artifact.loadoutId || state.selectedLoadoutId || 'VANGUARD';
        const loadout = DEFAULT_LOADOUTS[loadoutId];
        if (!loadout) return state;

        const mergedRuleset = resolveAcaeRuleset({
            ...state,
            ruleset: mergeRunRulesetOverrides(state.ruleset, artifact.rulesetOverrides)
        });
        const appliedLoadout = applyLoadoutToPlayer(loadout);
        const player = createEntity({
            id: 'player',
            type: 'player',
            position: artifact.playerSpawn,
            speed: INITIAL_PLAYER_STATS.speed,
            factionId: 'player',
            activeSkills: ensurePlayerCoreVisionSkill(ensureMobilitySkill(appliedLoadout.activeSkills)),
            archetype: appliedLoadout.archetype,
            weightClass: 'Standard',
            components: new Map()
        });
        const dailyRunDate = artifact.runMode === 'daily' && artifact.runDate
            ? toDateKey(artifact.runDate)
            : undefined;
        const nextState: GameState = {
            ...state,
            turnNumber: 1,
            player: {
                ...player,
                previousPosition: artifact.playerSpawn
            },
            enemies,
            companions: [],
            gridWidth: artifact.gridWidth,
            gridHeight: artifact.gridHeight,
            mapShape: artifact.mapShape,
            gameStatus: 'playing',
            message: [appendTaggedMessage([], 'Welcome to the arena. Survive.', 'INFO', 'SYSTEM')[0]],
            hasSpear: true,
            hasShield: true,
            stairsPosition: artifact.stairsPosition,
            occupancyMask: [0n],
            shrinePosition: artifact.shrinePosition,
            shrineOptions: undefined,
            floor: artifact.floor,
            upgrades: appliedLoadout.upgrades,
            rooms: artifact.rooms,
            theme: getFloorTheme(artifact.floor),
            commandLog: [],
            undoStack: [],
            rngSeed: artifact.runSeed,
            initialSeed: artifact.runSeed,
            rngCounter: 0,
            actionLog: [],
            kills: 0,
            environmentalKills: 0,
            turnsSpent: 0,
            dailyRunDate,
            runObjectives: dailyRunDate ? createDailyObjectives(createDailySeed(dailyRunDate)) : [],
            hazardBreaches: 0,
            completedRun: undefined,
            combatScoreEvents: [],
            runTelemetry: createEmptyRunTelemetry(),
            enemyAiTelemetry: createEmptyEnemyAiRunTelemetry(),
            dyingEntities: [],
            visualEvents: [],
            timelineEvents: [],
            intentPreview: undefined,
            visibility: undefined,
            initiativeQueue: undefined,
            tiles,
            generationState: artifact.generationDelta,
            generatedPaths: artifact.pathNetwork,
            worldgenDebug: artifact.debugSnapshot,
            selectedLoadoutId: loadoutId,
            ruleset: mergedRuleset
        };
        return finalizeArtifactAppliedState(nextState);
    }

    const nextFloorSeed = `${artifact.runSeed}:${artifact.floor}`;
    const nextPlayer = {
        ...state.player,
        hp: Math.min(state.player.maxHp, state.player.hp + 1),
        position: artifact.playerSpawn,
        previousPosition: artifact.playerSpawn
    };
    const seededState: GameState = {
        ...state,
        turnNumber: 1,
        player: nextPlayer,
        enemies,
        gridWidth: artifact.gridWidth,
        gridHeight: artifact.gridHeight,
        mapShape: artifact.mapShape,
        gameStatus: 'playing',
        message: appendTaggedMessage([], `Floor ${artifact.floor} - ${artifact.theme.charAt(0).toUpperCase() + artifact.theme.slice(1)}. Be careful.`, 'INFO', 'OBJECTIVE'),
        stairsPosition: artifact.stairsPosition,
        shrinePosition: artifact.shrinePosition,
        shrineOptions: undefined,
        pendingStatus: undefined,
        pendingFrames: undefined,
        floor: artifact.floor,
        rooms: artifact.rooms,
        theme: getFloorTheme(artifact.floor),
        commandLog: [],
        undoStack: [],
        rngSeed: nextFloorSeed,
        initialSeed: state.initialSeed || artifact.runSeed,
        rngCounter: 0,
        actionLog: [...(state.actionLog || [])],
        runTelemetry: state.runTelemetry,
        enemyAiTelemetry: state.enemyAiTelemetry,
        dyingEntities: [],
        visualEvents: [],
        timelineEvents: [],
        intentPreview: undefined,
        visibility: undefined,
        initiativeQueue: undefined,
        tiles,
        generationState: artifact.generationDelta,
        generatedPaths: artifact.pathNetwork,
        worldgenDebug: artifact.debugSnapshot
    };

    return finalizeArtifactAppliedState(migrateCompanionsToArtifactFloor(seededState, state));
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
        hasShield: false,
        generationState: undefined,
        generatedPaths: undefined,
        worldgenDebug: undefined
    };
};

export const generateInitialState = (
    floor: number = 1,
    seed?: string,
    initialSeed?: string,
    preservePlayer?: { hp: number; maxHp: number; upgrades: string[]; activeSkills?: any[] },
    loadout?: Loadout,
    mapSize?: GridSize,
    mapShape?: MapShape,
    generationOptions?: {
        generationSpec?: GenerationSpecInput;
        generationState?: GenerationState;
    }
): GameState => {
    ensureTacticalDataBootstrapped();

    // If no seed provided, we MUST generate one, but this should be rare in strict mode.
    const actualSeed = seed || String(Date.now());

    const resolvedMapConfig = resolveRunMapConfig(mapSize, mapShape);

    // Determine floor theme
    const theme = getFloorTheme(floor);

    const initialGenerationState = generationOptions?.generationState
        || createInitialCompilerGenerationState(initialSeed ?? actualSeed, generationOptions?.generationSpec);
    const compiledFloor = compileStandaloneFloor(floor, actualSeed, {
        gridWidth: resolvedMapConfig.width,
        gridHeight: resolvedMapConfig.height,
        mapShape: resolvedMapConfig.mapShape,
        generationSpec: generationOptions?.generationSpec,
        generationState: initialGenerationState
    });
    const dungeon = compiledFloor.dungeon;
    const enemies = compiledFloor.enemies;

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
    const activeSkills = ensurePlayerCoreVisionSkill(
        ensureMobilitySkill(preservePlayer?.activeSkills || loadoutApplied.activeSkills)
    );
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

    let tempState: GameState = {
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
        gridWidth: resolvedMapConfig.width,
        gridHeight: resolvedMapConfig.height,
        mapShape: resolvedMapConfig.mapShape,
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
        runTelemetry: (preservePlayer as any)?.runTelemetry || createEmptyRunTelemetry(),
        enemyAiTelemetry: (preservePlayer as any)?.enemyAiTelemetry || createEmptyEnemyAiRunTelemetry(),

        // Juice
        dyingEntities: [],
        visualEvents: [],
        timelineEvents: [],
        intentPreview: undefined,

        // Core Systems
        initiativeQueue: undefined, // Initialized below
        tiles: tiles,
        generationState: compiledFloor.generationState,
        generatedPaths: compiledFloor.artifact.pathNetwork,
        worldgenDebug: compiledFloor.debugSnapshot,
    };

    tempState.ruleset = withResolvedIresRuleset({
        ...tempState,
        ruleset: resolveAcaeRuleset(tempState)
    }).ruleset;
    tempState.ruleset = {
        ...(tempState.ruleset || {}),
        combat: {
            version: resolveCombatRuleset(tempState)
        }
    };
    if (loadout && !preservePlayer?.activeSkills) {
        const resolvedLoadout = applyLoadoutToPlayer(loadout);
        tempState.player = {
            ...tempState.player,
            activeSkills: ensurePlayerCoreVisionSkill(
                ensureMobilitySkill(resolvedLoadout.activeSkills)
            ),
            archetype: resolvedLoadout.archetype
        };
    }

    tempState = hydrateGameStateIres(tempState);
    tempState.initiativeQueue = buildInitiativeQueue(tempState);
    tempState.occupancyMask = SpatialSystem.refreshOccupancyMask(tempState);
    tempState = recomputeVisibility(tempState);
    tempState.intentPreview = buildIntentPreview(tempState);
    tempState.generationState = initializeGenerationForState(
        tempState.generationState,
        initialSeed ?? actualSeed,
        generationOptions?.generationSpec || tempState.generationState?.spec,
        tempState
    );

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

    let nextState = applyEffects(state, effects, {
        sourceId: actorId,
        stepId,
        ...(actor.subtype === 'bomb' ? { volatileBombVisited: [actor.id] } : {})
    });
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
    const normalizedBasePlayer = ensurePlayerLoadoutIntegrity(state.player);
    const normalizedPlayer = state.gameStatus === 'playing'
        ? ensurePlayingPlayerLoadoutIntegrity(normalizedBasePlayer)
        : normalizedBasePlayer;
    const normalizedState = normalizedPlayer === state.player
        ? state
        : { ...state, player: normalizedPlayer };

    if (normalizedState.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE' && action.type !== 'LOAD_STATE' && action.type !== 'APPLY_LOADOUT' && action.type !== 'START_RUN' && action.type !== 'APPLY_WORLDGEN_ARTIFACT' && action.type !== 'EXIT_TO_HUB') return normalizedState;

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
        case 'APPLY_WORLDGEN_ARTIFACT': {
            return applyCompiledFloorArtifactToState(normalizedState, action.payload);
        }
        case 'RESET': {
            const currentArchetype = state.player.archetype;
            const loadoutId = currentArchetype === 'SKIRMISHER' ? 'SKIRMISHER' : 'VANGUARD';
            const loadout = DEFAULT_LOADOUTS[loadoutId];
            return generateInitialState(
                1,
                action.payload?.seed || String(Date.now()),
                undefined,
                undefined,
                loadout,
                { width: state.gridWidth, height: state.gridHeight },
                state.mapShape,
                { generationSpec: state.generationState?.spec }
            );
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
    const nextActionLog = isReplayRecordableAction(action)
        ? [...(intermediateState.actionLog || []), action]
        : [...(intermediateState.actionLog || [])];

    return {
        ...intermediateState,
        commandLog: [...(intermediateState.commandLog || []), command],
        undoStack: [...(intermediateState.undoStack || []), delta],
        actionLog: nextActionLog
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
        gridWidth: state.gridWidth,
        gridHeight: state.gridHeight,
        mapShape: state.mapShape || 'diamond',
        turnNumber: state.turnNumber,
        kills: state.kills,
        rngCounter: state.rngCounter
    };

    return JSON.stringify(obj);
};
