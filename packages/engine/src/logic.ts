/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 */
import type { GameState, Action, Entity, AtomicEffect } from './types';
import { hexEquals, getNeighbors } from './hex';
import { resolveTelegraphedAttacks, resolveSingleEnemyTurn } from './systems/combat';
import { INITIAL_PLAYER_STATS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { checkShrine, checkStairs, getEnemyAt, applyFireDamage } from './helpers';
import { increaseMaxHp } from './systems/actor';
import { generateDungeon, generateEnemies, getFloorTheme } from './systems/map';
import { tickSkillCooldowns, UPGRADE_DEFINITIONS, addUpgrade, createDefaultSkills, applyPassiveSkills } from './systems/legacy-skills';
import { COMPOSITIONAL_SKILLS } from './skillRegistry';
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
    isPlayerTurn,
} from './systems/initiative';
import { tickStatuses } from './systems/status';


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
    } : INITIAL_PLAYER_STATS;

    const upgrades = preservePlayer?.upgrades || (loadout ? loadout.startingUpgrades : []);
    const loadoutApplied = loadout ? applyLoadoutToPlayer(loadout) : { activeSkills: createDefaultSkills(), archetype: 'VANGUARD' as const };
    const activeSkills = preservePlayer?.activeSkills || loadoutApplied.activeSkills;
    const archetype = (preservePlayer as any)?.archetype || loadoutApplied.archetype;

    // Unified Tile Service: Initialized directly from dungeon
    const tiles = dungeon.tiles || new Map();

    const tempState: GameState = {
        turnNumber: 1,
        player: {
            ...playerStats,
            id: 'player',
            type: 'player',
            factionId: 'player',
            position: dungeon.playerSpawn,
            previousPosition: dungeon.playerSpawn,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills,
            components: new Map(),
            archetype: archetype
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

        // Juice
        dyingEntities: [],
        visualEvents: [],

        // Core Systems
        initiativeQueue: undefined, // Initialized below
        tiles: tiles,
    };

    tempState.initiativeQueue = buildInitiativeQueue(tempState);
    tempState.occupancyMask = SpatialSystem.refreshOccupancyMask(tempState);

    return tempState;
};

const executeStatusWindow = (state: GameState, actorId: string, window: 'START_OF_TURN' | 'END_OF_TURN'): { state: GameState, messages: string[] } => {
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

    const newState = applyEffects(state, effects, { sourceId: actorId });
    return { state: newState, messages };
};

export const processNextTurn = (state: GameState): GameState => {
    let curState = state;
    let messages: string[] = [];
    const dyingEntities: Entity[] = [];

    const { queue: nextQueue, actorId } = advanceInitiative(curState);
    curState = { ...curState, initiativeQueue: nextQueue };

    if (!actorId) return curState;

    if (actorId === curState.player.id) {
        curState = { ...curState, initiativeQueue: startActorTurn(curState, curState.player) };
        return curState;
    }

    const enemy = curState.enemies.find(e => e.id === actorId);
    if (!enemy) {
        curState = { ...curState, initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId) };
        return processNextTurn(curState);
    }

    curState = { ...curState, initiativeQueue: startActorTurn(curState, enemy) };
    const turnStartPos = getTurnStartPosition(curState, actorId)!;

    const sotResult = executeStatusWindow(curState, actorId, 'START_OF_TURN');
    curState = sotResult.state;
    messages.push(...sotResult.messages);

    let activeEnemy = curState.enemies.find(e => e.id === actorId);
    if (!activeEnemy) return curState;

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

    const isStunned = activeEnemy.statusEffects.some(s => s.type === 'stunned');
    if (isStunned) {
        messages.push(`${activeEnemy.subtype || activeEnemy.type} is stunned and skips their turn!`);
    } else {
        const tele = resolveTelegraphedAttacks(curState, curState.player.position, actorId);
        curState = tele.state;
        messages.push(...tele.messages);

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

    const eotResult = executeStatusWindow(curState, actorId, 'END_OF_TURN');
    curState = eotResult.state;
    messages.push(...eotResult.messages);

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

const resolveTurnCycle = (state: GameState): GameState => {
    let curState = state;
    const playerPos = state.player.position;
    const messages: string[] = [];

    const playerStartPos = getTurnStartPosition(curState, 'player') || curState.player.previousPosition || curState.player.position;
    const persistentNeighborIds = getTurnStartNeighborIds(curState, 'player') ?? undefined;
    const autoAttackResult = applyAutoAttack(
        curState,
        curState.player,
        getNeighbors(playerStartPos),
        playerStartPos,
        persistentNeighborIds
    );
    curState = autoAttackResult.state;
    messages.push(...autoAttackResult.messages);

    if (curState.spearPosition && hexEquals(playerPos, curState.spearPosition)) {
        curState.hasSpear = true;
        curState.spearPosition = undefined;
        messages.push('Picked up your spear.');
    }

    const eotResult = executeStatusWindow(curState, 'player', 'END_OF_TURN');
    curState = eotResult.state;
    messages.push(...eotResult.messages);

    const tileTickResult = tickTileEffects(curState);
    curState = tileTickResult.state;
    messages.push(...tileTickResult.messages);

    let player = tickSkillCooldowns(curState.player);
    player = tickStatuses(player);
    player = applyPassiveSkills(player);

    curState = {
        ...curState,
        player,
        message: [...curState.message, ...messages].slice(-50),
        kills: curState.kills + autoAttackResult.kills,
        turnNumber: curState.turnNumber + 1,
        turnsSpent: curState.turnsSpent + 1,
        initiativeQueue: endActorTurn(curState, 'player')
    };

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
            const score = (state.floor * 1000);
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

        return {
            ...curState,
            pendingStatus: {
                status: 'playing',
            },
            message: [...curState.message, 'Descending to the next level...'].slice(-50)
        };
    }

    return curState;
};

export const resolveEnemyActions = (state: GameState): GameState => {
    SpatialSystem.refreshOccupancyMask(state);
    /** TODO: 
     * This will not work. Your state is immutable. To update the mask, you must assign the result back to the state:
     * 
     * TypeScript
     * 
     * export const resolveEnemyActions = (state: GameState): GameState => {
     *     const updatedMask = SpatialSystem.refreshOccupancyMask(state);
     *     const nextState = { ...state, occupancyMask: updatedMask };
     *     return resolveTurnCycle(nextState);
     * };
     */
    return resolveTurnCycle(state);
};

export const gameReducer = (state: GameState, action: Action): GameState => {
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
            return loaded;
        }
        case 'RESET': {
            const currentArchetype = state.player.archetype;
            const loadoutId = currentArchetype === 'SKIRMISHER' ? 'SKIRMISHER' : 'VANGUARD';
            const loadout = DEFAULT_LOADOUTS[loadoutId];
            return generateInitialState(1, action.payload?.seed || String(Date.now()), undefined, undefined, loadout);
        }
    }

    if (state.gameStatus !== 'playing' && action.type !== 'SELECT_UPGRADE' && action.type !== 'APPLY_LOADOUT' && action.type !== 'START_RUN') return state;

    const command = createCommand(action);
    const oldState = state;

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
                const { skillId, target } = a.payload;
                const skill = s.player.activeSkills?.find(sk => sk.id === skillId);
                const compDef = COMPOSITIONAL_SKILLS[skillId];

                if (compDef) {
                    const targetEnemy = target ? getEnemyAt(s.enemies, target) : undefined;
                    const execution = compDef.execute(s, s.player, target, skill?.activeUpgrades || []);
                    let newState = applyEffects(s, execution.effects, { targetId: targetEnemy?.id });
                    const stateAfterSkill = {
                        ...newState,
                        message: [...newState.message, ...execution.messages].slice(-50)
                    };
                    if (execution.consumesTurn === false) return stateAfterSkill;
                    return resolveEnemyActions(stateAfterSkill);
                }
                return s;
            }

            case 'MOVE': {
                if (!('payload' in a)) return s;
                const target = a.payload;

                // BUMP ATTACK: If there is an enemy at the target, redirect to BASIC_ATTACK
                const enemyAtTarget = getEnemyAt(s.enemies, target);
                if (enemyAtTarget) {
                    const attackSkillId = s.player.activeSkills?.find(sk => sk.id === 'BASIC_ATTACK')?.id;
                    if (attackSkillId) {
                        return gameReducer(s, { type: 'USE_SKILL', payload: { skillId: attackSkillId, target } });
                    }
                }

                const moveSkillId = s.player.activeSkills?.find(sk => sk.id === 'BASIC_MOVE' || sk.id === 'DASH')?.id;
                if (moveSkillId) {
                    return gameReducer(s, { type: 'USE_SKILL', payload: { skillId: moveSkillId, target } });
                }
                return s;
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
                const { loadoutId, seed } = a.payload;
                const loadout = DEFAULT_LOADOUTS[loadoutId];
                if (!loadout) return s;
                return generateInitialState(1, seed, undefined, undefined, loadout);
            }

            case 'ADVANCE_TURN': {
                return processNextTurn(s);
            }

            case 'RESOLVE_PENDING': {
                if (!s.pendingStatus) return s;
                const { status, shrineOptions, completedRun } = s.pendingStatus;
                if (status === 'playing' && s.gameStatus === 'playing') {
                    const baseSeed = s.initialSeed ?? s.rngSeed ?? '0';
                    const nextSeed = `${baseSeed}:${s.floor + 1}`;
                    return generateInitialState(s.floor + 1, nextSeed, baseSeed, {
                        ...s.player,
                        hp: Math.min(s.player.maxHp, s.player.hp + 1),
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

    const intermediateState = resolveGameState(curState, action);
    const delta = createDelta(oldState, intermediateState);
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
