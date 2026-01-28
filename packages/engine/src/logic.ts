/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 * TODO: Migrate all remaining legacy skills (Spear/Shield/Jump) to the Compositional Framework.
 */
import type { GameState, Action, Entity, AtomicEffect } from './types';
import { hexEquals, getNeighbors } from './hex';
import { resolveTelegraphedAttacks, resolveSingleEnemyTurn } from './systems/combat';
import { INITIAL_PLAYER_STATS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { checkShrine, checkStairs, getEnemyAt, applyFireDamage } from './helpers';
import { increaseMaxHp } from './systems/actor';
import { generateDungeon, generateEnemies, getFloorTheme } from './systems/map';
import {
    tickSkillCooldowns,
    UPGRADE_DEFINITIONS,
    addUpgrade,
    createDefaultSkills,
    executeShieldBash,
    executeJump,
    executeSpearThrow,
    executeLunge,
    applyPassiveSkills,
    hasUpgrade,
} from './systems/legacy-skills';
import { COMPOSITIONAL_SKILLS } from './skillRegistry';
import { applyEffects } from './systems/effect-engine';
import { migratePositionArraysToTiles } from './systems/tile-migration';

import { applyAutoAttack } from './skills/auto_attack';
import { refreshOccupancyMask } from './systems/spatial';
import { createCommand, createDelta } from './systems/commands';
import {
    buildInitiativeQueue,
    advanceInitiative,
    startActorTurn,
    endActorTurn,
    removeFromQueue,
    getTurnStartPosition,
    getTurnStartNeighborIds,
    isPlayerTurn,
} from './systems/initiative';
import { type PhysicsComponent, type ArchetypeComponent, type GameComponent } from './systems/components';
import { tickStatuses } from './systems/status';
import { createInitialTileGrid, pointToKey } from './systems/tile-migration';
import { BASE_TILES } from './systems/tile-registry';


/**
 * Generate initial state with the new tactical arena generation
 */
import { consumeRandom } from './systems/rng';
import { applyLoadoutToPlayer, type Loadout, DEFAULT_LOADOUTS } from './systems/loadout';
import { tickTileEffects } from './systems/tile-tick';


export const generateHubState = (): GameState => {
    const base = generateInitialState();
    // In the Hub we don't want to expose a fully populated tactical state.
    // Present an empty skill bar so the UI prompts the player to choose a loadout.
    return {
        ...base,
        gameStatus: 'hub',
        message: ['Welcome to the Strategic Hub. Select your loadout.'],
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
    // If no seed provided, we MUST generate one, but this should be rare in strict mode.
    // For now, fall back to Date.now() ONLY if strictly necessary, but ideally caller provides it.
    const actualSeed = seed || String(Date.now());

    // Determine floor theme
    const theme = getFloorTheme(floor);

    // Use tactical arena generation for all floors
    const dungeon = generateDungeon(floor, actualSeed);
    const enemies = generateEnemies(floor, dungeon.spawnPositions, actualSeed);

    // Build player state (preserve HP/upgrades/skills across floors)
    const playerStats = preservePlayer ? {
        hp: preservePlayer.hp,
        maxHp: preservePlayer.maxHp,
        speed: (preservePlayer as any).speed || INITIAL_PLAYER_STATS.speed,
    } : INITIAL_PLAYER_STATS;

    const upgrades = preservePlayer?.upgrades || (loadout ? loadout.startingUpgrades : []);
    const loadoutApplied = loadout ? applyLoadoutToPlayer(loadout) : { activeSkills: createDefaultSkills(), archetype: 'VANGUARD' as const };
    const activeSkills = preservePlayer?.activeSkills || loadoutApplied.activeSkills;
    const archetype = (preservePlayer as any)?.archetype || loadoutApplied.archetype;

    // Use the fixed playerSpawn from dungeon generation
    const playerPos = dungeon.playerSpawn;

    const initialState: GameState = {
        turnNumber: 1,
        player: {
            id: 'player',
            type: 'player',
            factionId: 'player',
            position: playerPos,
            previousPosition: playerPos,
            ...playerStats,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills,
            archetype,
            components: new Map<string, GameComponent>([
                ['physics', { type: 'physics', weightClass: 'Standard' } as PhysicsComponent],
                ['archetype', { type: 'archetype', archetype } as ArchetypeComponent]
            ])
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
            ? ['Welcome to the arena. Survive.']
            : [...(preservePlayer as any)?.message || [], `Floor ${floor} - ${theme.charAt(0).toUpperCase() + theme.slice(1)}. Be careful.`].slice(-50),
        hasSpear: true,
        rngSeed: actualSeed,
        initialSeed: initialSeed ?? (floor === 1 ? actualSeed : undefined),
        rngCounter: 0,
        stairsPosition: dungeon.stairsPosition,
        lavaPositions: dungeon.lavaPositions,
        wallPositions: dungeon.wallPositions,
        occupancyMask: [], // Will be refreshed below
        shrinePosition: dungeon.shrinePosition,
        shrineOptions: undefined,
        hasShield: true,
        floor: floor,
        rooms: dungeon.rooms,
        theme,
        upgrades,
        commandLog: [],
        undoStack: [],
        actionLog: [],
        kills: preservePlayer ? (preservePlayer as any).kills || 0 : 0,
        environmentalKills: preservePlayer ? (preservePlayer as any).environmentalKills || 0 : 0,
        turnsSpent: preservePlayer ? (preservePlayer as any).turnsSpent || 0 : 0,
        dyingEntities: [],
        visualEvents: [],
        initiativeQueue: undefined, // Initialized below
        tiles: new Map(), // Initialized below
    };

    // Initialize the new Tile System
    initialState.tiles = createInitialTileGrid(dungeon.allHexes);

    // Fill with hazards from generation
    dungeon.lavaPositions.forEach(p => {
        const key = pointToKey(p);
        initialState.tiles.set(key, {
            baseId: 'LAVA',
            position: p,
            traits: new Set(BASE_TILES.LAVA.defaultTraits),
            effects: []
        });
    });
    dungeon.wallPositions.forEach(p => {
        const key = pointToKey(p);
        initialState.tiles.set(key, {
            baseId: 'WALL',
            position: p,
            traits: new Set(BASE_TILES.WALL.defaultTraits),
            effects: []
        });
    });

    initialState.initiativeQueue = buildInitiativeQueue(initialState);

    initialState.occupancyMask = refreshOccupancyMask(initialState);

    return initialState;
};

/**
 * HELPER: Interceptor for Status Hooks
 * Dispatches effects based on the specific turn window.
 */
const executeStatusWindow = (state: GameState, actorId: string, window: 'START_OF_TURN' | 'END_OF_TURN'): { state: GameState, messages: string[] } => {
    const actor = actorId === 'player' ? state.player : state.enemies.find(e => e.id === actorId);
    if (!actor) return { state, messages: [] };
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    actor.statusEffects.forEach(status => {
        // Only trigger if the status defines this window
        if (status.tickWindow === window && status.onTick) {
            const result = status.onTick(actor, state);
            if (result) {
                effects.push(...result);
            }
        }
    });

    const newState = applyEffects(state, effects, { sourceId: actorId });
    return { state: newState, messages };
};

/**
 * Process exactly ONE actor's turn (non-player) from the initiative queue.
 * Yields control back to the caller (UI) for potential delays.
 */
export const processNextTurn = (state: GameState): GameState => {
    let curState = state;
    let messages: string[] = [];
    const dyingEntities: Entity[] = [];

    // 1. Advance to next actor
    const { queue: nextQueue, actorId } = advanceInitiative(curState);
    curState = { ...curState, initiativeQueue: nextQueue };

    if (!actorId) return curState;

    // 2. Player Turn Initiation
    if (actorId === curState.player.id) {
        curState = { ...curState, initiativeQueue: startActorTurn(curState, curState.player) };
        return curState;
    }

    // 3. Enemy Validation
    const enemy = curState.enemies.find(e => e.id === actorId);
    if (!enemy) {
        curState = { ...curState, initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId) };
        return processNextTurn(curState);
    }

    // 4. START OF TURN WINDOW
    curState = { ...curState, initiativeQueue: startActorTurn(curState, enemy) };
    const turnStartPos = getTurnStartPosition(curState, actorId)!;

    const sotResult = executeStatusWindow(curState, actorId, 'START_OF_TURN');
    curState = sotResult.state;
    messages.push(...sotResult.messages);

    // Re-fetch enemy after SOT effects
    let activeEnemy = curState.enemies.find(e => e.id === actorId);
    if (!activeEnemy) return curState;

    // Fire Damage Tick (Start of Turn)
    const fireRes = applyFireDamage(curState, activeEnemy.position, activeEnemy);
    if (fireRes.messages.length > 0) {
        messages.push(...fireRes.messages);
        curState = {
            ...curState,
            enemies: curState.enemies.map(e => e.id === actorId ? fireRes.entity : e)
        };
        activeEnemy = fireRes.entity as Entity;
    }
    if (activeEnemy.hp <= 0) return curState;

    // 5. ACTION PHASE (Skip if Stunned)
    const isStunned = activeEnemy.statusEffects.some(s => s.type === 'stunned');
    if (isStunned) {
        messages.push(`${activeEnemy.subtype || activeEnemy.type} is stunned and skips their turn!`);
    } else {
        // Resolve Telegraphed Attacks
        const tele = resolveTelegraphedAttacks(curState, curState.player.position, actorId);
        curState = tele.state;
        messages.push(...tele.messages);

        // Resolve AI Movement/Skills
        const updatedEnemy = curState.enemies.find(e => e.id === actorId);
        if (updatedEnemy) {
            const turnResult = resolveSingleEnemyTurn(curState, updatedEnemy, turnStartPos);
            curState = turnResult.state;
            messages.push(...turnResult.messages);

            if (turnResult.isDead) {
                return {
                    ...curState,
                    enemies: curState.enemies.filter(e => e.id !== actorId),
                    initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId),
                    message: [...curState.message, ...messages].slice(-50)
                };
            }
        }
    }

    // 6. END OF TURN WINDOW (Status Decay & EOT Effects)
    const eotResult = executeStatusWindow(curState, actorId, 'END_OF_TURN');
    curState = eotResult.state;
    messages.push(...eotResult.messages);

    // Final cleanup: decrement durations and remove expired
    curState = {
        ...curState,
        enemies: curState.enemies.map(e => e.id === actorId ? tickStatuses(e) : e),
        initiativeQueue: endActorTurn(curState, actorId)
    };

    return {
        ...curState,
        message: [...curState.message, ...messages].slice(-50),
        dyingEntities: [...(curState.dyingEntities || []), ...dyingEntities]
    };
};

/**
 * Main entry point for turn cycle resolution.
 * Granularly resolves actors until player input IS required.
 */
const resolveTurnCycle = (state: GameState): GameState => {
    let curState = state;
    const playerPos = state.player.position;
    const messages: string[] = [];

    // 1. START OF TURN (Player) - Happens before player action in next call, 
    // but for the "Wrap Up", we process the current turn's EOT logic.

    // 2. Auto Attack

    const playerStartPos = getTurnStartPosition(curState, 'player') || curState.player.previousPosition || curState.player.position;
    const persistentNeighborIds = getTurnStartNeighborIds(curState, 'player') ?? undefined;
    const autoAttackResult = applyAutoAttack(
        curState,
        curState.player,
        getNeighbors(playerStartPos),
        playerStartPos,
        persistentNeighborIds // Now guaranteed to be string[] | undefined
    );
    curState = autoAttackResult.state;
    messages.push(...autoAttackResult.messages);

    // Item Pickups (Spear/Shield)
    if (curState.spearPosition && hexEquals(playerPos, curState.spearPosition)) {
        curState.hasSpear = true;
        curState.spearPosition = undefined;
        messages.push('Picked up your spear.');
    }

    // 3. END OF TURN WINDOW (Player Hooks)
    const eotResult = executeStatusWindow(curState, 'player', 'END_OF_TURN');
    curState = eotResult.state;
    messages.push(...eotResult.messages);

    // 4. Tile Tick & Effects (onStay)
    const tileTickResult = tickTileEffects(curState);
    curState = tileTickResult.state;
    messages.push(...tileTickResult.messages);

    // 5. Decay and Initiative End
    let player = tickSkillCooldowns(curState.player);

    player = tickStatuses(player);
    player = applyPassiveSkills(player);

    // 6. Final State Update
    curState = {
        ...curState,
        player,
        message: [...curState.message, ...messages].slice(-50),

        kills: curState.kills + autoAttackResult.kills,
        turnNumber: curState.turnNumber + 1,
        turnsSpent: curState.turnsSpent + 1,
        initiativeQueue: endActorTurn(curState, 'player')
    };

    // PHASE 2: Check for world-state transitions (Stairs/Shrine)
    if (checkShrine(curState, playerPos)) {
        const allUpgrades = Object.keys(UPGRADE_DEFINITIONS);
        const available = allUpgrades.filter(u => !state.upgrades.includes(u));
        const picked: string[] = [];
        let rngState = { ...curState };
        for (let i = 0; i < 3 && available.length > 0; i++) {
            const res = consumeRandom(rngState);
            rngState = res.nextState;
            const idx = Math.floor(res.value * available.length);
            picked.push(available[idx]);
            available.splice(idx, 1);
        }
        return {
            ...curState,
            rngCounter: rngState.rngCounter,
            pendingStatus: {
                status: 'choosing_upgrade',
                shrineOptions: picked.length > 0 ? picked : ['EXTRA_HP']
            },
            message: [...curState.message, 'A holy shrine! Choose an upgrade.'].slice(-50)
        };
    }

    if (checkStairs(curState, playerPos)) {
        const arcadeMax = 10;
        if (state.floor >= arcadeMax) {
            const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
            const speedBonus = Math.max(0, (state.floor * 30 - state.turnsSpent) * 50);
            const damagePenalty = (player.maxHp - player.hp) * 10;
            const score = (state.floor * 1000) + speedBonus - damagePenalty;
            return {
                ...curState,
                pendingStatus: {
                    status: 'won',
                    completedRun: {
                        seed: baseSeed,
                        actionLog: state.actionLog,
                        score,
                        floor: state.floor
                    }
                },
                message: [...curState.message, `Arcade Cleared! Final Score: ${score}`].slice(-50)
            };
        }

        // Standard next floor
        return {
            ...curState,
            pendingStatus: {
                status: 'playing', // Special case: this will trigger a full state regeneration
            },
            message: [...curState.message, 'Descending to the next level...'].slice(-50)
        };
    }

    // PHASE 3: Yield control. The UI will call processNextTurn until player's turn.
    return curState;
};

// DEPRECATED ALIAS: resolveEnemyActions is now handled via processNextTurn loop.
// For compatibility with old tests/logic calling resolveEnemyActions directly:
export const resolveEnemyActions = (state: GameState): GameState => {
    // 0. Update AI positions for pathfinding
    refreshOccupancyMask(state);
    return resolveTurnCycle(state);
};

export const gameReducer = (state: GameState, action: Action): GameState => {
    // Allow certain meta actions while in non-playing states (hub/won/lost)
    if (state.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE' && action.type !== 'LOAD_STATE' && action.type !== 'APPLY_LOADOUT' && action.type !== 'START_RUN') return state;

    const clearedState: GameState = {
        ...state,
        isShaking: false,
        lastSpearPath: undefined,
        dyingEntities: [],
        occupiedCurrentTurn: undefined,
        visualEvents: []
    };

    switch (action.type) {
        case 'LOAD_STATE': {
            const loaded = action.payload;
            // Legacy Migration
            if (!loaded.tiles || (loaded.tiles instanceof Map === false && !Array.isArray(loaded.tiles))) {
                console.log('[Logic] Migrating loaded state to Tile System...');
                loaded.tiles = migratePositionArraysToTiles(loaded);
            } else if (Array.isArray(loaded.tiles)) {
                // If serialization saved it as array entries, convert back to Map
                loaded.tiles = new Map(loaded.tiles);
            }
            return loaded;
        }
        case 'RESET': {
            // Meta-Persistence: Preserve the current archetype/loadout on reset
            const currentArchetype = state.player.archetype;
            const loadoutId = currentArchetype === 'SKIRMISHER' ? 'SKIRMISHER' : 'VANGUARD';
            const loadout = DEFAULT_LOADOUTS[loadoutId];

            const newState = generateInitialState(1, action.payload?.seed || String(Date.now()), undefined, undefined, loadout);
            return {
                ...newState,
                commandLog: [],
                undoStack: [],
                actionLog: []
            };
        }
    }

    if (state.gameStatus !== 'playing' && action.type !== 'SELECT_UPGRADE' && action.type !== 'APPLY_LOADOUT' && action.type !== 'START_RUN') return state;

    // Command Pattern (Goal 2)
    const command = createCommand(action);
    const oldState = state;

    // Standard start-of-player-turn setup
    let curState = {
        ...clearedState,
        initiativeQueue: clearedState.initiativeQueue // Don't reset turn start on every action!
    };

    let intermediateState: GameState;

    // Wrapped logic to produce the next state
    const resolveGameState = (s: GameState, a: Action): GameState => {
        // Guard: Prevent player actions if it's not currently the player's turn
        const playerActions = ['MOVE', 'THROW_SPEAR', 'WAIT', 'USE_SKILL', 'JUMP', 'SHIELD_BASH', 'ATTACK', 'LEAP'];
        if (playerActions.includes(a.type) && !isPlayerTurn(s)) {
            return s;
        }

        switch (a.type) {
            case 'SELECT_UPGRADE': {
                if (!('payload' in a)) return s;
                const upgradeId = a.payload;
                let player = s.player;

                const upgradeDef = UPGRADE_DEFINITIONS[upgradeId];
                if (upgradeDef) {
                    player = addUpgrade(player, upgradeDef.skill, upgradeId);
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
                    message: [...s.message, `Gained ${upgradeDef?.name || upgradeId}!`].slice(-50)
                };
            }

            case 'USE_SKILL': {
                if (!('payload' in a)) return s;
                const { skillId, target } = a.payload;

                // PRE-ACTION SNAPSHOT for Auto-Attack Persistence (captured in initiative entries now)

                // Lunge handling (as upgrade of Spear Throw)
                const isLunge = skillId === 'LUNGE';
                const skill = isLunge
                    ? s.player.activeSkills?.find(s => s.id === 'SPEAR_THROW')
                    : s.player.activeSkills?.find(s => s.id === skillId);

                if (!isLunge && (!skill || skill.currentCooldown > 0)) {
                    return { ...s, message: [...s.message, skill ? 'Skill on cooldown!' : 'You don\'t have this skill!'].slice(-50) };
                }

                if (isLunge && !hasUpgrade(s.player, 'SPEAR_THROW', 'LUNGE')) {
                    return { ...s, message: [...s.message, 'You don\'t have the Lunge upgrade!'].slice(-50) };
                }

                // 1. Compositional Skill
                const compDef = COMPOSITIONAL_SKILLS[skillId];
                if (compDef) {
                    const targetEnemy = target ? getEnemyAt(s.enemies, target) : undefined;
                    const activeUpgrades = skill?.activeUpgrades || [];
                    const execution = compDef.execute(s, s.player, target, activeUpgrades);

                    let newState = applyEffects(s, execution.effects, { targetId: targetEnemy?.id });

                    const stateAfterSkill = {
                        ...newState,
                        message: [...newState.message, ...execution.messages].slice(-50)
                    };

                    // Stealth Decay: Offensive actions reduce stealth
                    if ((stateAfterSkill.player.stealthCounter || 0) > 0) {
                        stateAfterSkill.player = {
                            ...stateAfterSkill.player,
                            stealthCounter: Math.max(0, stateAfterSkill.player.stealthCounter! - 1)
                        };
                    }

                    // If the execution does not consume a turn, do NOT apply cooldowns or advance enemy actions.
                    if (execution.consumesTurn === false) {
                        return stateAfterSkill;
                    }

                    // Apply skill cooldowns only when the skill actually consumed the player's action.
                    const withCooldowns: GameState = {
                        ...stateAfterSkill,
                        player: {
                            ...stateAfterSkill.player,
                            activeSkills: stateAfterSkill.player.activeSkills?.map((s: any) =>
                                s.id === skillId ? { ...s, currentCooldown: compDef.baseVariables.cooldown } : s
                            )
                        }
                    };

                    return resolveEnemyActions(withCooldowns);
                }

                // 2. Legacy Skills (Fallback)
                let result;
                switch (skillId) {
                    case 'SPEAR_THROW': result = executeSpearThrow(target!, state); break;
                    case 'SHIELD_BASH': result = executeShieldBash(target!, state); break;
                    case 'JUMP': result = executeJump(target!, state); break;
                    case 'LUNGE': result = executeLunge(target!, state); break;
                    default: return { ...clearedState, message: [...state.message, `Unknown skill: ${skillId}`].slice(-50) };
                }

                if (result.messages[0].includes('not in hand') || result.messages[0].includes('out of range')) {
                    return { ...clearedState, message: [...state.message, ...result.messages].slice(-50) };
                }

                // Legacy skill application
                let newLavaPositions = state.lavaPositions;
                if (result.lavaCreated?.length) newLavaPositions = [...state.lavaPositions, ...result.lavaCreated];

                if (result.consumesTurn === false) {
                    return {
                        ...s,
                        player: result.player,
                        enemies: result.enemies,
                        lavaPositions: newLavaPositions,
                        message: [...s.message, ...result.messages].slice(-50),
                        environmentalKills: (s.environmentalKills || 0) + (result.environmentalKills || 0),
                        kills: (s.kills || 0) + (result.kills || 0),
                        lastSpearPath: result.lastSpearPath,
                        isShaking: result.isShaking
                    };
                }

                return resolveEnemyActions({
                    ...s,
                    player: result.player,
                    enemies: result.enemies,
                    lavaPositions: newLavaPositions,
                    message: [...s.message, ...result.messages].slice(-50),
                    environmentalKills: (s.environmentalKills || 0) + (result.environmentalKills || 0),
                    kills: (s.kills || 0) + (result.kills || 0),
                    lastSpearPath: result.lastSpearPath,
                    isShaking: result.isShaking
                });
            }

            case 'MOVE': {
                if (!('payload' in a)) return s;
                const target = a.payload;

                // 1. Check if there is an enemy at the target location
                const targetEnemy = s.enemies.find(e => hexEquals(e.position, target));

                if (targetEnemy) {
                    // REDIRECT TO ATTACK: If an enemy is there, try to use the first offensive skill
                    const attackSkillId = s.player.activeSkills?.find(sk =>
                        sk.id === 'BASIC_ATTACK' || sk.id === 'SHIELD_BASH' || sk.id === 'SPEAR_THROW'
                    )?.id;

                    if (attackSkillId) {
                        const skillAction: Action = { type: 'USE_SKILL', payload: { skillId: attackSkillId, target } };
                        return gameReducer(s, skillAction);
                    }
                }

                // 2. Standard Movement Logic (If no enemy or no attack skill found)
                const moveSkillId = s.player.activeSkills?.find(sk => sk.id === 'BASIC_MOVE' || sk.id === 'DASH')?.id;

                if (moveSkillId) {
                    const skillAction: Action = { type: 'USE_SKILL', payload: { skillId: moveSkillId, target } };
                    return gameReducer(s, skillAction);
                }

                return { ...s, message: [...s.message, "This unit is stationary."].slice(-50) };
            }

            case 'THROW_SPEAR': {
                if (!('payload' in a)) return s;
                const target = a.payload;

                const result = executeSpearThrow(target, s);
                if (result.messages[0].includes('not in hand')) return { ...s, message: [...s.message, result.messages[0]].slice(-50) };

                return resolveEnemyActions({
                    ...s,
                    enemies: result.enemies,
                    hasSpear: result.hasSpear ?? false,
                    spearPosition: result.spearPosition,
                    message: [...s.message, ...result.messages].slice(-50),
                    kills: (s.kills || 0) + (result.kills || 0),
                    lastSpearPath: result.lastSpearPath,
                    isShaking: result.isShaking
                });
            }

            case 'WAIT': {
                return resolveEnemyActions(s);
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
                    message: [...s.message, `${loadout.name} selected.`].slice(-50)
                };
            }

            case 'START_RUN': {
                console.log('Reducer: START_RUN', a.payload);
                const { loadoutId, seed } = a.payload;
                const loadout = DEFAULT_LOADOUTS[loadoutId];
                if (!loadout) {
                    console.error('Reducer: Loadout not found!', loadoutId);
                    return s;
                }
                // Generate a fresh state for Floor 1 with the chosen loadout
                return generateInitialState(1, seed, undefined, undefined, loadout);
            }

            case 'ADVANCE_TURN': {
                return processNextTurn(s);
            }

            case 'RESOLVE_PENDING': {
                if (!s.pendingStatus) return s;
                const { status, shrineOptions, completedRun } = s.pendingStatus;

                if (status === 'playing' && s.gameStatus === 'playing') {
                    // This is a floor transition
                    const baseSeed = s.initialSeed ?? s.rngSeed ?? '0';
                    const nextSeed = `${baseSeed}:${s.floor + 1}`;
                    const nextHp = Math.min(s.player.maxHp, s.player.hp + 1);
                    return generateInitialState(s.floor + 1, nextSeed, baseSeed, {
                        ...s.player,
                        hp: nextHp,
                        upgrades: s.upgrades,
                    });
                }

                return {
                    ...s,
                    gameStatus: status,
                    shrineOptions: shrineOptions || s.shrineOptions,
                    completedRun: completedRun || (s as any).completedRun,
                    pendingStatus: undefined
                };
            }

            case 'EXIT_TO_HUB': {
                return generateHubState();
            }

            default:
                return s;
        }
    };

    intermediateState = resolveGameState(curState, action);

    // Finalize Command and Delta
    const delta = createDelta(oldState, intermediateState);
    command.delta = delta;

    return {
        ...intermediateState,
        commandLog: [...(intermediateState.commandLog || []), command],
        undoStack: [...(intermediateState.undoStack || []), delta],
        actionLog: [...(intermediateState.actionLog || []), action]
    };
};

/**
 * Generates a deterministic fingerprint for state verification.
 */
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

