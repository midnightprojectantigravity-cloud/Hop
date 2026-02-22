/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 */
import type { GameState, Action, Entity, AtomicEffect, PendingFrame, PendingFrameType } from './types';
import { hexEquals, getNeighbors } from './hex';
import { resolveTelegraphedAttacks } from './systems/combat';
import { INITIAL_PLAYER_STATS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { checkShrine, checkStairs, getEnemyAt } from './helpers';
import { generateDungeon, generateEnemies, getFloorTheme } from './systems/map';
import { tickActorSkills, addUpgrade, increaseMaxHp } from './systems/actor';
import { SkillRegistry, createDefaultSkills } from './skillRegistry';
import { applyEffects } from './systems/effect-engine';

import { applyAutoAttack } from './skills/auto_attack';
import { SpatialSystem } from './systems/SpatialSystem';
import { createCommand, createDelta } from './systems/commands';
import {
    buildInitiativeQueue,
    advanceInitiative,
    startActorTurn,
    endActorTurn,
    removeFromQueue,
    getTurnStartPosition,
    getTurnStartNeighborIds,
    getCurrentEntry,
    isPlayerTurn,
} from './systems/initiative';
import { isStunned, tickStatuses } from './systems/status';
import { createEntity, ensureActorTrinity } from './systems/entity-factory';


/**
 * Generate initial state with the new tactical arena generation
 */
import { consumeRandom } from './systems/rng';
import { applyLoadoutToPlayer, type Loadout, DEFAULT_LOADOUTS, ensureMobilitySkill, ensurePlayerLoadoutIntegrity } from './systems/loadout';
import { tickTileEffects } from './systems/tile-tick';
import { buildIntentPreview } from './systems/telegraph-projection';
import { buildRunSummary, createDailyObjectives, createDailySeed, toDateKey } from './systems/run-objectives';
import { UnifiedTileService } from './systems/unified-tile-service';
import { appendTaggedMessage, appendTaggedMessages } from './systems/engine-messages';
import { ensureTacticalDataBootstrapped } from './systems/tactical-data-bootstrap';

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

const createPendingFrame = (
    state: GameState,
    type: PendingFrameType,
    status: PendingFrame['status'],
    payload?: Record<string, unknown>
): PendingFrame => {
    const idx = (state.pendingFrames?.length ?? 0) + 1;
    return {
        id: `${state.turnNumber}:${status}:${type}:${idx}`,
        type,
        status,
        createdTurn: state.turnNumber,
        blocking: true,
        payload
    };
};

const withPendingFrame = (
    state: GameState,
    pendingStatus: NonNullable<GameState['pendingStatus']>,
    frameType: PendingFrameType,
    framePayload?: Record<string, unknown>
): GameState => {
    const frame = createPendingFrame(state, frameType, pendingStatus.status as PendingFrame['status'], framePayload);
    return {
        ...state,
        pendingStatus,
        pendingFrames: [...(state.pendingFrames || []), frame]
    };
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

    const newState = applyEffects(state, effects, { sourceId: actorId, stepId });
    return { state: newState, messages };
};

// NEW PIPELINE IMPORTS
import { StrategyRegistry } from './systems/strategy-registry';
import { processIntent } from './systems/intent-middleware';
import { TacticalEngine } from './systems/tactical-engine';
import type { Intent } from './types/intent';
import { ManualStrategy } from './strategy/manual';

export const processNextTurn = (state: GameState, isResuming: boolean = false): GameState => {
    if (state.pendingStatus || (state.pendingFrames?.length ?? 0) > 0) {
        warnTurnStackInvariant('Blocked processNextTurn while pendingStatus is active.', {
            status: state.pendingStatus?.status,
            pendingFrames: state.pendingFrames?.length ?? 0,
            turnNumber: state.turnNumber
        });
        return state;
    }
    let curState = state;
    const messages: string[] = [];
    const dyingEntities: Entity[] = [];

    // Safety brake for recursive/infinite loops
    let iterations = 0;
    const MAX_ITERATIONS = 100;

    let skipAdvance = false;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // GLOBAL DEATH CHECK: If player is dead, the game is over.
        if (curState.player.hp <= 0 && curState.pendingStatus?.status !== 'lost') {
            const completedRun = buildRunSummary(curState);
            return withPendingFrame(
                {
                    ...curState,
                    message: appendTaggedMessage(curState.message, 'You have fallen...', 'CRITICAL', 'COMBAT')
                },
                {
                    status: 'lost',
                    completedRun
                },
                'RUN_LOST',
                { reason: 'GLOBAL_DEATH_CHECK' }
            );
        }
        curState.occupancyMask = SpatialSystem.refreshOccupancyMask(curState);

        let actorId: string | undefined;

        if (((isResuming && iterations === 1) || skipAdvance) && curState.initiativeQueue) {
            skipAdvance = false;
            const q = curState.initiativeQueue;
            if (q.entries.length > 0 && q.currentIndex >= 0 && q.currentIndex < q.entries.length) {
                actorId = q.entries[q.currentIndex].actorId;
            }
        } else {
            // 1. Advance Initiative normally
            const res = advanceInitiative(curState);
            curState = { ...curState, initiativeQueue: res.queue };
            actorId = res.actorId ?? undefined;
        }

        if (!actorId) break; // End of round?

        const actor = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
        const actorStepId = `${curState.turnNumber}:${curState.initiativeQueue?.round ?? 0}:${actorId}:${iterations}`;

        // If actor is missing/dead, remove from queue and continue
        if (!actor || actor.hp <= 0) {
            curState = { ...curState, initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId) };
            continue;
        }

        // 2. Start Turn Logic
        const entry = getCurrentEntry(curState.initiativeQueue!);
        if (!entry?.turnStartPosition) {
            curState = { ...curState, initiativeQueue: startActorTurn(curState, actor) };
        }

        if (!isResuming || iterations > 1) {
            const sotResult = executeStatusWindow(curState, actorId, 'START_OF_TURN', actorStepId);
            curState = sotResult.state;
            messages.push(...sotResult.messages);

            if (actorId === 'player' && curState.upgrades?.includes('RELIC_STEADY_PLATES')) {
                const boostedArmor = Math.min(2, (curState.player.temporaryArmor || 0) + 1);
                if (boostedArmor !== (curState.player.temporaryArmor || 0)) {
                    curState = {
                        ...curState,
                        player: {
                            ...curState.player,
                            temporaryArmor: boostedArmor
                        }
                    };
                    messages.push(appendTaggedMessage([], 'Steady Plates harden your stance.', 'INFO', 'COMBAT')[0]);
                }
            }

            const tele = resolveTelegraphedAttacks(curState, curState.player.position, actorId, actorStepId);
            curState = tele.state;
            messages.push(...tele.messages);
        }


        // Re-fetch actor after status updates (might have died?)
        const activeActor = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
        if (!activeActor || activeActor.hp <= 0) {
            curState = {
                ...curState,
                initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId),
                message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM')
            };
            continue;
        }

        // 5. THE AGENCY PIPELINE
        const actorForIntent = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
        if (!actorForIntent || actorForIntent.hp <= 0) {
            continue;
        }
        let intent: Intent;
        let forcedStunSkip = false;
        if (isStunned(actorForIntent)) {
            forcedStunSkip = true;
            intent = {
                type: 'WAIT',
                actorId: actorForIntent.id,
                skillId: 'WAIT_SKILL',
                priority: 0,
                metadata: {
                    expectedValue: 0,
                    reasoningCode: 'STATUS_STUNNED_AUTOSKIP',
                    isGhost: false
                }
            };
            if (actorId === 'player') {
                messages.push('You are stunned and skip your turn.');
            } else {
                messages.push(`${actorForIntent.subtype || 'Enemy'} is stunned and skips its turn.`);
            }
        } else {
            const strategy = StrategyRegistry.resolve(actorForIntent);
            const intentOrPromise = strategy.getIntent(curState, actorForIntent);

            // Check if we need to wait for input (Manual Strategy)
            if (intentOrPromise instanceof Promise) {
                // HALT EXECUTION: Return state and wait for input action
                const intentPreview = buildIntentPreview(curState);
                return {
                    ...curState,
                    intentPreview,
                    message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM'),
                    dyingEntities: [...(curState.dyingEntities || []), ...dyingEntities]
                };
            }

            // We have a synchronous Intent
            intent = intentOrPromise as Intent;
        }

        // DEEP DIAGNOSTIC: Log Loadout and Intent
        const loadoutStr = activeActor.activeSkills.map(s => s.id).join(', ');
        if (ENGINE_DEBUG) {
            console.log(`[ENGINE] Actor: ${actorId} | Loadout: [${loadoutStr}] | Pos: ${JSON.stringify(activeActor.position)}`);
            console.log(`[ENGINE] Intent: ${intent.type} | Skill: ${intent.skillId} | TargetHex: ${intent.targetHex ? JSON.stringify(intent.targetHex) : 'none'} | TargetId: ${intent.primaryTargetId || 'none'}`);
        }

        // Apply RNG Consumption from Strategy (if any)
        if (intent.metadata.rngConsumption) {
            curState = {
                ...curState,
                rngCounter: (curState.rngCounter || 0) + intent.metadata.rngConsumption
            };
        }

        // 6. Middleware Layer
        intent = processIntent(intent, curState, actorForIntent);

        // 7. Tactical Execution Layer
        const { effects, messages: tacticalMessages, consumesTurn, targetId, kills } = TacticalEngine.execute(intent, actorForIntent, curState);
        // Console log for headless debugging (Intent Fidelity)
        if (ENGINE_DEBUG) {
            console.log(`[ENGINE] ${actorId} intends ${intent.type} (${intent.skillId}) onto ${targetId || (intent.targetHex ? JSON.stringify(intent.targetHex) : 'self')}`);
        }


        // WORLD-CLASS LOGIC: The "Smoking Gun" Debug Log
        // If an intent produces zero effects, we need to know why in headless mode.
        if (ENGINE_WARN && effects.length === 0 && intent.type !== 'WAIT') {
            const warnMsg = `[ENGINE] WARNING: Intent ${intent.type} (${intent.skillId}) for actor ${actorId} produced ZERO effects!`;
            console.warn(warnMsg);
        }

        // 8. Apply Effects
        // Note: applyEffects handles damage, healing, movement, etc.
        const stateBeforeEffects = curState;
        const nextState = applyEffects(curState, effects, { sourceId: actorId, targetId, stepId: actorStepId });

        if (actorId === 'player') {
            nextState.kills = (nextState.kills || 0) + (kills || 0);
        }

        // 9. Post-Action Cleanup / End of Turn

        // Handle Turn Consumption (FIDELITY GUARD)
        if (consumesTurn === false) {
            // Revert state for non-consuming actions (except MESSAGES)
            curState = {
                ...stateBeforeEffects,
                message: appendTaggedMessages(curState.message, tacticalMessages, 'INFO', 'COMBAT')
            };
            skipAdvance = true;
            continue; // Loop back for SAME actor!
        }

        // Success Path
        curState = nextState;
        messages.push(...tacticalMessages);

        // Preserve bomber cast cadence until enemy skill cooldowns are fully unified.
        if (actorId !== 'player') {
            const actingEnemy = curState.enemies.find(e => e.id === actorId);
            if (actingEnemy?.subtype === 'bomber') {
                const nextCooldown = intent.skillId === 'BOMB_TOSS'
                    ? 2
                    : Math.max(0, (actingEnemy.actionCooldown ?? 0) - 1);
                if (actingEnemy.actionCooldown !== nextCooldown) {
                    curState = {
                        ...curState,
                        enemies: curState.enemies.map(e => e.id === actorId ? { ...e, actionCooldown: nextCooldown } : e)
                    };
                }
            }
        }

        // Check Death
        const postActionActor = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
        if (!postActionActor || postActionActor.hp <= 0) {
            // Actor died during their own turn (e.g. walked into lava)
            if (actorId === 'player') {
                const completedRun = buildRunSummary(curState);
                return withPendingFrame(
                    {
                        ...curState,
                        message: appendTaggedMessage(
                            appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM'),
                            'You have fallen...',
                            'CRITICAL',
                            'COMBAT'
                        )
                    },
                    { status: 'lost', completedRun },
                    'RUN_LOST',
                    { reason: 'SELF_ACTION_DEATH' }
                );
            }
            curState = {
                ...curState,
                enemies: curState.enemies.filter(e => e.id !== actorId),
                initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId),
                message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM')
            };
            continue; // Next actor
        }

        // End of Turn Statuses
        const eotResult = executeStatusWindow(curState, actorId, 'END_OF_TURN', actorStepId);
        curState = eotResult.state;
        messages.push(...eotResult.messages);

        curState = {
            ...curState,
            enemies: curState.enemies.map(e => e.id === actorId ? tickStatuses(e) : e),
            player: actorId === 'player' ? tickStatuses(curState.player) : curState.player,
            initiativeQueue: endActorTurn(curState, actorId)
        };

        // 10. Passives / After-Turn Cleanup (Auto-Attack, etc)
        const actorAfterTurn = actorId === 'player' ? curState.player : curState.enemies.find(e => e.id === actorId);
        const skipPassivesThisTurn =
            forcedStunSkip
            || intent.metadata?.reasoningCode === 'STATUS_STUNNED'
            || intent.metadata?.reasoningCode === 'STATUS_STUNNED_AUTOSKIP';

        if (!skipPassivesThisTurn && actorAfterTurn && actorAfterTurn.hp > 0) {
            const playerStartPos = getTurnStartPosition(curState, actorId) || actorAfterTurn.previousPosition || actorAfterTurn.position;
            const persistentNeighborIds = getTurnStartNeighborIds(curState, actorId) ?? undefined;

            const autoAttackResult = applyAutoAttack(
                curState,
                actorAfterTurn,
                getNeighbors(playerStartPos),
                playerStartPos,
                persistentNeighborIds,
                actorStepId
            );
            curState = autoAttackResult.state;
            messages.push(...autoAttackResult.messages);
            if (actorId === 'player') {
                curState.kills = (curState.kills || 0) + autoAttackResult.kills;
            }
        }

        if (actorId === 'player') {
            const playerPos = curState.player.position;

            // 1. Pick up spear if on it
            if (curState.spearPosition && hexEquals(playerPos, curState.spearPosition)) {
                curState = {
                    ...curState,
                    hasSpear: true,
                    spearPosition: undefined,
                    message: appendTaggedMessage(curState.message, 'Picked up your spear.', 'INFO', 'OBJECTIVE')
                };
            }

            // 2. Tile Ticks (Lava damage, etc)
            const tileTickResult = tickTileEffects(curState);
            curState = tileTickResult.state;
            messages.push(...tileTickResult.messages);

            curState.player = tickActorSkills(curState.player);
            curState = { ...curState, turnNumber: curState.turnNumber + 1, turnsSpent: (curState.turnsSpent || 0) + 1 };

            // CHECK TILE INTERACTIONS (Shrines / Stairs)
            if (checkShrine(curState, curState.player.position)) {
                const allUpgrades = SkillRegistry.getAllUpgrades().map(u => u.id);
                const available = allUpgrades.filter(u => !curState.upgrades.includes(u));
                const picked: string[] = [];
                let rngState = { ...curState };
                for (let i = 0; i < 3 && available.length > 0; i++) {
                    const res = consumeRandom(rngState);
                    rngState = res.nextState;
                    const idx = Math.floor(res.value * available.length);
                    picked.push(available[idx]);
                    available.splice(idx, 1);
                }
                const shrineOptions = picked.length > 0 ? picked : ['EXTRA_HP'];
                return withPendingFrame(
                    {
                        ...curState,
                        rngCounter: rngState.rngCounter,
                        message: appendTaggedMessage(curState.message, 'A holy shrine! Choose an upgrade.', 'INFO', 'OBJECTIVE')
                    },
                    {
                        status: 'choosing_upgrade',
                        shrineOptions
                    },
                    'SHRINE_CHOICE',
                    { shrineOptions }
                );
            }

            if (checkStairs(curState, curState.player.position)) {
                const arcadeMax = 10;
                if (curState.floor >= arcadeMax) {
                    const completedRun = buildRunSummary(curState);
                    return withPendingFrame(
                        {
                            ...curState,
                            message: appendTaggedMessage(curState.message, `Arcade Cleared! Final Score: ${completedRun.score}`, 'INFO', 'OBJECTIVE')
                        },
                        {
                            status: 'won',
                            completedRun
                        },
                        'RUN_WON',
                        { score: completedRun.score ?? 0 }
                    );
                }

                return withPendingFrame(
                    {
                        ...curState,
                        message: appendTaggedMessage(curState.message, 'Descending to the next level...', 'INFO', 'OBJECTIVE')
                    },
                    {
                        status: 'playing',
                    },
                    'STAIRS_TRANSITION',
                    { nextFloor: curState.floor + 1 }
                );
            }
        }

        // Loop continues to next actor
    }

    const intentPreview = buildIntentPreview(curState);
    return {
        ...curState,
        intentPreview,
        message: appendTaggedMessages(curState.message, messages, 'INFO', 'SYSTEM'),
        dyingEntities: [...(curState.dyingEntities || []), ...dyingEntities]
    };
};



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
            const loaded = action.payload;
            if (Array.isArray(loaded.tiles)) {
                loaded.tiles = new Map(
                    loaded.tiles.map(([key, tile]: [string, any]) => [
                        key,
                        {
                            ...tile,
                            traits: new Set(tile.traits), // Hydrate the Set!
                        }
                    ])
                );
            }
            loaded.player = ensurePlayerLoadoutIntegrity(ensureActorTrinity(loaded.player));
            loaded.enemies = (loaded.enemies || []).map(ensureActorTrinity);
            if (loaded.companions) {
                loaded.companions = loaded.companions.map(ensureActorTrinity);
            }
            return loaded;
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

    const resolveGameState = (s: GameState, a: Action): GameState => {
        const playerActions = ['MOVE', 'THROW_SPEAR', 'WAIT', 'USE_SKILL', 'JUMP', 'SHIELD_BASH', 'ATTACK', 'LEAP'];
        if (playerActions.includes(a.type) && !isPlayerTurn(s)) {
            return s;
        }

        switch (a.type) {
            case 'SELECT_UPGRADE': {
                if (!('payload' in a)) return s;
                const upgradeId = a.payload;
                let player = s.player;
                const upgradeDef = SkillRegistry.getUpgrade(upgradeId);
                if (upgradeDef) {
                    // Find which skill this upgrade belongs to
                    const skillId = SkillRegistry.getSkillForUpgrade(upgradeId);
                    if (skillId) {
                        player = addUpgrade(player, skillId, upgradeId);
                    }
                } else if (upgradeId === 'EXTRA_HP') {
                    player = increaseMaxHp(player, 1, true);
                }
                return {
                    ...s,
                    player,
                    upgrades: [...s.upgrades, upgradeId],
                    gameStatus: 'playing',
                    shrinePosition: undefined,
                    shrineOptions: undefined,
                    message: appendTaggedMessage(s.message, `Gained ${upgradeDef?.name || upgradeId}!`, 'INFO', 'OBJECTIVE')
                };
            }

            case 'USE_SKILL': {
                const { skillId, target } = a.payload;
                // Handle Player Action via ManualStrategy
                const strategy = StrategyRegistry.resolve(s.player);
                if (strategy instanceof ManualStrategy) {
                    strategy.pushIntent({
                        type: 'USE_SKILL',
                        actorId: s.player.id,
                        skillId,
                        targetHex: target,
                        priority: 10,
                        metadata: { expectedValue: 0, reasoningCode: 'PLAYER_INPUT', isGhost: false }
                    });
                }
                return processNextTurn(s, true); // Resume! Action was added to intent queue.
            }

            case 'MOVE': {
                if (!('payload' in a)) return s;
                const target = a.payload;

                const playerSkills = s.player.activeSkills || [];
                const enemyAtTarget = getEnemyAt(s.enemies, target);

                const preferredOrder = ['BASIC_ATTACK', 'BASIC_MOVE', 'DASH'];
                const passiveSkills = playerSkills.filter(sk => sk.slot === 'passive');
                const sortedSkills = [
                    ...passiveSkills.filter(sk => preferredOrder.includes(sk.id)),
                    ...passiveSkills.filter(sk => !preferredOrder.includes(sk.id))
                ];

                // Pick the first skill whose valid targets include this tile.
                let chosenSkillId: string | undefined;
                for (const sk of sortedSkills) {
                    const def = SkillRegistry.get(sk.id);
                    if (!def?.getValidTargets) continue;
                    const validTargets = def.getValidTargets(s, s.player.position);
                    if (validTargets.some(v => hexEquals(v, target))) {
                        chosenSkillId = sk.id;
                        break;
                    }
                }

                if (!chosenSkillId) {
                    // Preserve click contracts without inventing skills:
                    // route to basic interaction only if this actor actually has it.
                    const hasBasicAttack = playerSkills.some(sk => sk.id === 'BASIC_ATTACK');
                    const hasBasicMove = playerSkills.some(sk => sk.id === 'BASIC_MOVE');

                    if (enemyAtTarget && hasBasicAttack) {
                        chosenSkillId = 'BASIC_ATTACK';
                    } else if (!enemyAtTarget && hasBasicMove) {
                        chosenSkillId = 'BASIC_MOVE';
                    } else {
                        return {
                            ...s,
                            message: appendTaggedMessage(
                                s.message,
                                enemyAtTarget ? 'No valid passive attack for target.' : 'No valid passive movement for target.',
                                'CRITICAL',
                                'SYSTEM'
                            )
                        };
                    }
                }

                // Intent type: if targeting an enemy, mark as ATTACK; otherwise MOVE.
                const intentType: any = enemyAtTarget ? 'ATTACK' : 'MOVE';
                const skillId = chosenSkillId;

                const strategy = StrategyRegistry.resolve(s.player);
                if (strategy instanceof ManualStrategy) {
                    strategy.pushIntent({
                        type: intentType,
                        actorId: s.player.id,
                        skillId,
                        targetHex: target,
                        primaryTargetId: enemyAtTarget?.id,
                        priority: 10,
                        metadata: { expectedValue: 0, reasoningCode: 'PLAYER_INPUT', isGhost: false }
                    });
                }
                return processNextTurn(s, true); // Resume!
            }

            case 'WAIT': {
                const strategy = StrategyRegistry.resolve(s.player);
                if (strategy instanceof ManualStrategy) {
                    strategy.pushIntent({
                        type: 'WAIT',
                        actorId: s.player.id,
                        skillId: 'WAIT',
                        priority: 10,
                        metadata: { expectedValue: 0, reasoningCode: 'PLAYER_INPUT', isGhost: false }
                    });
                }
                return processNextTurn(s, true); // Resume!
            }

            case 'APPLY_LOADOUT': {
                if (!('payload' in a)) return s;
                const loadout = a.payload as Loadout;
                const applied = applyLoadoutToPlayer(loadout);
                return {
                    ...s,
                    player: {
                        ...s.player,
                        activeSkills: applied.activeSkills,
                        archetype: applied.archetype,
                    },
                    upgrades: applied.upgrades,
                    hasSpear: loadout.startingSkills.includes('SPEAR_THROW'),
                    hasShield: loadout.startingSkills.includes('SHIELD_THROW') || s.hasShield,
                    selectedLoadoutId: loadout.id,
                    message: appendTaggedMessage(s.message, `${loadout.name} selected.`, 'INFO', 'SYSTEM')
                };
            }

            case 'START_RUN': {
                const { loadoutId, seed, mode, date } = a.payload;
                const loadout = DEFAULT_LOADOUTS[loadoutId];
                if (!loadout) return s;
                if (mode === 'daily') {
                    const dateKey = toDateKey(date);
                    const dailySeed = createDailySeed(dateKey);
                    const next = generateInitialState(1, seed || dailySeed, undefined, undefined, loadout);
                    return {
                        ...next,
                        dailyRunDate: dateKey,
                        runObjectives: createDailyObjectives(dailySeed),
                        hazardBreaches: 0
                    };
                }
                return generateInitialState(1, seed, undefined, undefined, loadout);
            }

            case 'ADVANCE_TURN': {
                if (s.pendingStatus || (s.pendingFrames?.length ?? 0) > 0) {
                    warnTurnStackInvariant('Ignored ADVANCE_TURN while pendingStatus is active.', {
                        status: s.pendingStatus?.status,
                        pendingFrames: s.pendingFrames?.length ?? 0,
                        turnNumber: s.turnNumber
                    });
                    return s;
                }
                return processNextTurn(s, false);
            }

            case 'RESOLVE_PENDING': {
                const pendingFrames = s.pendingFrames || [];
                if (pendingFrames.length > 1) {
                    return {
                        ...s,
                        pendingFrames: pendingFrames.slice(1)
                    };
                }
                if (!s.pendingStatus) {
                    if (pendingFrames.length === 1) {
                        return {
                            ...s,
                            pendingFrames: []
                        };
                    }
                    return s;
                }
                const { status, shrineOptions, completedRun } = s.pendingStatus;
                if (status === 'playing' && s.gameStatus === 'playing') {
                    const baseSeed = s.initialSeed ?? s.rngSeed ?? '0';
                    const nextSeed = `${baseSeed}:${s.floor + 1}`;
                    const migratingSummons = s.enemies
                        .filter(e => e.hp > 0 && e.factionId === 'player' && e.companionOf === s.player.id)
                        .sort((a, b) => a.id.localeCompare(b.id));
                    const next = generateInitialState(s.floor + 1, nextSeed, baseSeed, {
                        ...s.player,
                        hp: Math.min(s.player.maxHp, s.player.hp + 1),
                        upgrades: s.upgrades,
                    });
                    if (migratingSummons.length > 0) {
                        const candidates = [next.player.position, ...getNeighbors(next.player.position)];
                        const occupied: Entity[] = [next.player, ...next.enemies];
                        const migrated: Entity[] = [];

                        for (let i = 0; i < migratingSummons.length; i++) {
                            const summon = migratingSummons[i];
                            const fallback = candidates[candidates.length - 1] || next.player.position;
                            const spawnPos = candidates.find(pos => {
                                const unoccupied = !occupied.some(a => hexEquals(a.position, pos));
                                return unoccupied && UnifiedTileService.isWalkable(next, pos);
                            }) || fallback;
                            const migratedSummon: Entity = {
                                ...summon,
                                position: spawnPos,
                                previousPosition: spawnPos
                            };
                            occupied.push(migratedSummon);
                            migrated.push(migratedSummon);
                        }

                        next.enemies = [...next.enemies, ...migrated];
                        next.companions = [
                            ...(next.companions || []),
                            ...migrated.filter(e => e.companionOf === s.player.id)
                        ];
                        next.initiativeQueue = buildInitiativeQueue(next);
                        next.occupancyMask = SpatialSystem.refreshOccupancyMask(next);
                    }
                    return {
                        ...next,
                        actionLog: [...(s.actionLog || [])],
                        dailyRunDate: s.dailyRunDate,
                        runObjectives: s.runObjectives,
                        hazardBreaches: s.hazardBreaches || 0,
                        pendingFrames: undefined
                    };
                }
                return {
                    ...s,
                    gameStatus: status,
                    shrineOptions: shrineOptions || s.shrineOptions,
                    completedRun: completedRun || (s as any).completedRun,
                    pendingStatus: undefined,
                    pendingFrames: undefined
                };
            }

            case 'EXIT_TO_HUB': {
                return generateHubState();
            }



            default:
                return s;
        }
    };

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
