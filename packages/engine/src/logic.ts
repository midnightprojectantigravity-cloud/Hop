/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 * TODO: Migrate all remaining legacy skills (Spear/Shield/Jump) to the Compositional Framework.
 */
import type { GameState, Action, Point, Entity, AtomicEffect } from './types';
import { hexDistance, hexEquals, getNeighbors, getHexLine, getDirectionFromTo, hexDirection, hexAdd } from './hex';
import { resolveTelegraphedAttacks } from './combat';
import { INITIAL_PLAYER_STATS, GRID_WIDTH, GRID_HEIGHT } from './constants';
import { applyLavaDamage, checkShrine, checkStairs, getEnemyAt, isWalkable, isOccupied } from './helpers';
import { increaseMaxHp } from './actor';
import { generateDungeon, generateEnemies, getFloorTheme } from './mapGeneration';
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
} from './skills';
import { COMPOSITIONAL_SKILLS } from './skillRegistry';
import { applyEffects, applyAtomicEffect } from './effectEngine';
import { applyAutoAttack } from './skills/auto_attack';
import { refreshOccupancyMask } from './spatial';
import { createCommand, createDelta } from './commands';
import {
    buildInitiativeQueue,
    advanceInitiative,
    startActorTurn,
    endActorTurn,
    removeFromQueue,
    getTurnStartPosition,
} from './initiative';
import { resolveSingleEnemyTurn } from './combat';


/**
 * Generate initial state with the new tactical arena generation
 */
import { consumeRandom } from './rng';
import { applyLoadoutToPlayer, type Loadout } from './loadout';

// In generateInitialState signature
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
        turn: 1,
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
    };

    initialState.initiativeQueue = buildInitiativeQueue(initialState);
    initialState.occupancyMask = refreshOccupancyMask(initialState);

    return initialState;
};

/**
 * Process the turns for all non-player actors in the initiative queue
 * until the queue is exhausted or we return to the player.
 */
const processRemainingTurns = (state: GameState): GameState => {
    let curState = state;
    const messages: string[] = [];
    const dyingEntities: Entity[] = [];

    // Safety loop to prevent infinite acting if logic is broken
    let iterations = 0;
    while (iterations < 100) {
        iterations++;

        // 1. Advance to next actor
        const { queue: nextQueue, actorId } = advanceInitiative(curState);
        curState = { ...curState, initiativeQueue: nextQueue };

        if (!actorId) break;

        // 2. If it's the player's turn again, stop processing granularly
        if (actorId === curState.player.id) {
            // Player's turn starts now - wait for input
            return {
                ...curState,
                message: [...curState.message, ...messages].slice(-50),
                dyingEntities: [...(curState.dyingEntities || []), ...dyingEntities]
            };
        }

        // 3. Find the actor
        const enemy = curState.enemies.find(e => e.id === actorId);
        if (!enemy) {
            // Unit might have died before its turn (e.g. Cleave/Lava)
            curState = { ...curState, initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId) };
            continue;
        }

        // 4. Start turn (capture start position)
        curState = { ...curState, initiativeQueue: startActorTurn(curState, enemy) };
        const turnStartPos = getTurnStartPosition(curState, actorId)!;

        // 5. Resolve Telegraphed Attacks (if any)
        const tele = resolveTelegraphedAttacks(curState, curState.player.position, actorId);
        curState = tele.state;
        messages.push(...tele.messages);

        // 6. Resolve individual turn (Movement, AI, Auto-Attack)
        const updatedEnemy = curState.enemies.find(e => e.id === actorId);
        if (!updatedEnemy) continue;

        const turnResult = resolveSingleEnemyTurn(curState, updatedEnemy, turnStartPos);
        curState = turnResult.state;
        messages.push(...turnResult.messages);
        if (turnResult.isDead) {
            dyingEntities.push(enemy);
            curState = { ...curState, initiativeQueue: removeFromQueue(curState.initiativeQueue!, actorId) };
        } else {
            // 7. End turn
            curState = { ...curState, initiativeQueue: endActorTurn(curState, actorId) };
        }

        if (curState.player.hp <= 0) break;
    }

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
    let player = state.player;
    let enemies = state.enemies;
    const playerPos = state.player.position;
    const messages: string[] = [];

    // PHASE 1: Finalize Player Turn
    // (Player action was already applied by the caller to 'state')

    // 1. Resolve Lava Damage for Player
    const lavaRes = applyLavaDamage(state, playerPos, player);
    player = lavaRes.entity;
    messages.push(...lavaRes.messages);

    // 2. Auto Attack (Punch Passive) for Player
    // Use the granular turn start position from initiative queue if available
    const playerStartPos = getTurnStartPosition(state, 'player') || state.player.previousPosition || state.player.position;
    const previousNeighbors = getNeighbors(playerStartPos);

    let intermediateState = { ...state, player: { ...player, position: playerPos }, enemies };
    const autoAttackResult = applyAutoAttack(intermediateState, player, previousNeighbors, playerStartPos);
    enemies = autoAttackResult.state.enemies;
    messages.push(...autoAttackResult.messages);
    const killsThisTurn = autoAttackResult.kills;
    const totalKills = (state.kills || 0) + killsThisTurn;

    // 3. Item Pickups
    let hasSpear = state.hasSpear;
    let spearPos = state.spearPosition;
    if (spearPos && hexEquals(playerPos, spearPos)) {
        hasSpear = true; spearPos = undefined;
        messages.push('Picked up your spear.');
        if (player.activeSkills?.some(s => s.id === 'SPEAR_THROW' && s.activeUpgrades.includes('CLEAVE'))) {
            const adj = getNeighbors(playerPos);
            enemies = enemies.map(e => {
                if (adj.some(a => hexEquals(a, e.position))) {
                    messages.push(`Cleave hit ${e.subtype}!`);
                    return { ...e, hp: e.hp - 1 };
                }
                return e;
            }).filter(e => e.hp > 0);
        }
    }

    let hasShield = state.hasShield;
    let shieldPos = state.shieldPosition;
    if (shieldPos && hexEquals(playerPos, shieldPos)) {
        hasShield = true; shieldPos = undefined;
        messages.push('Picked up your shield.');
    }

    // 4. Update positions and turn state for player persistence in next turn
    player = { ...player, previousPosition: playerPos, position: playerPos };
    player = tickSkillCooldowns(player);
    player = applyPassiveSkills(player);

    let curState: GameState = {
        ...state,
        player,
        enemies,
        hasSpear,
        spearPosition: spearPos,
        hasShield,
        shieldPosition: shieldPos,
        message: [...state.message, ...messages].slice(-50),
        kills: totalKills,
        gameStatus: player.hp <= 0 ? 'lost' : 'playing',
    };

    // Mark player turn as acting done
    curState = { ...curState, initiativeQueue: endActorTurn(curState, 'player') };

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
            gameStatus: 'choosing_upgrade',
            shrineOptions: picked.length > 0 ? picked : ['EXTRA_HP'],
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
                gameStatus: 'won',
                message: [...curState.message, `Arcade Cleared! Final Score: ${score}`].slice(-50),
                completedRun: {
                    seed: baseSeed,
                    actionLog: state.actionLog,
                    score,
                    floor: state.floor
                }
            };
        }
        const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
        const nextSeed = `${baseSeed}:${state.floor + 1}`;
        const nextHp = Math.min(player.maxHp, player.hp + 1);
        return generateInitialState(state.floor + 1, nextSeed, baseSeed, {
            hp: nextHp,
            maxHp: player.maxHp,
            upgrades: state.upgrades,
            activeSkills: player.activeSkills,
            kills: curState.kills,
            environmentalKills: state.environmentalKills,
        } as any);
    }

    // PHASE 3: Process the rest of the unit queue
    return processRemainingTurns(curState);
};

const resolveEnemyActions = resolveTurnCycle;

export const gameReducer = (state: GameState, action: Action): GameState => {
    if (state.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE' && action.type !== 'LOAD_STATE') return state;

    const clearedState: GameState = {
        ...state,
        isShaking: false,
        lastSpearPath: undefined,
        dyingEntities: [],
        occupiedCurrentTurn: undefined,
        visualEvents: []
    };

    switch (action.type) {
        case 'LOAD_STATE':
            return action.payload;
        case 'RESET': {
            const newState = generateInitialState(1, action.payload?.seed || String(Date.now()));
            return {
                ...newState,
                commandLog: [],
                undoStack: [],
                actionLog: []
            };
        }
    }

    if (state.gameStatus !== 'playing' && action.type !== 'SELECT_UPGRADE') return state;

    // Command Pattern (Goal 2)
    const command = createCommand(action);
    const oldState = state;

    // Standard start-of-player-turn setup
    let curState = {
        ...clearedState,
        initiativeQueue: startActorTurn(clearedState, clearedState.player)
    };

    let intermediateState: GameState;

    // Wrapped logic to produce the next state
    const resolveGameState = (s: GameState, a: Action): GameState => {
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

                    newState.player = {
                        ...newState.player,
                        activeSkills: newState.player.activeSkills?.map((s: any) =>
                            s.id === skillId ? { ...s, currentCooldown: compDef.baseVariables.cooldown } : s
                        )
                    };

                    const playerMoveEffect = execution.effects.find(e => e.type === 'Displacement' && e.target === 'self') as { type: 'Displacement', destination: Point } | undefined;
                    const playerMovedTo = playerMoveEffect ? playerMoveEffect.destination : newState.player.position;

                    const stateAfterSkill = {
                        ...newState,
                        message: [...newState.message, ...execution.messages].slice(-50)
                    };

                    if (execution.consumesTurn === false) {
                        return stateAfterSkill;
                    }
                    return resolveEnemyActions(stateAfterSkill);
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
                const dist = hexDistance(s.player.position, target);

                const isSkirmisher = s.player.archetype === 'SKIRMISHER';
                const maxDist = isSkirmisher ? 4 : 1;

                if (dist < 1 || dist > maxDist) return s;

                // For dashes (dist > 1), must be in a straight line
                if (dist > 1) {
                    const line = getHexLine(s.player.position, target);
                    if (!hexEquals(line[line.length - 1], target)) return s;

                    // Check if path is clear or if tackle is possible
                    const path = line.slice(1); // Exclude start
                    for (let i = 0; i < path.length; i++) {
                        const pos = path[i];
                        const enemy = getEnemyAt(s.enemies, pos);
                        const isWall = s.wallPositions.some(w => hexEquals(w, pos));

                        if (isWall) {
                            // Blocked by wall
                            return { ...s, message: [...s.message, "Blocked by wall!"].slice(-50) };
                        }

                        if (enemy) {
                            if (isSkirmisher && s.hasShield) {
                                // TACKLE!
                                const dirIdx = getDirectionFromTo(s.player.position, target);
                                const dirVec = hexDirection(dirIdx);

                                // Push enemy 4 tiles
                                let pushDest = pos;
                                for (let j = 0; j < 4; j++) {
                                    const next = hexAdd(pushDest, dirVec);
                                    if (isWalkable(next, s.wallPositions, [], s.gridWidth, s.gridHeight)) {
                                        pushDest = next;
                                    } else {
                                        break;
                                    }
                                }

                                // Apply displacement to enemy
                                let newState = s;
                                newState = applyAtomicEffect(newState, { type: 'Displacement', target: 'targetActor', destination: pushDest }, { targetId: enemy.id });
                                newState = applyAtomicEffect(newState, { type: 'ApplyStatus', target: pushDest, status: 'stunned', duration: 1 }, { targetId: enemy.id });
                                newState.message.push(`Tackled ${enemy.subtype}!`);

                                // Player stops at pos? Or continues? 
                                // Usually tackle means you stop at the tile BEFORE or AT the enemy.
                                // Let's say stop AT the enemy's old pos.
                                if (i === path.length - 1) {
                                    // Move to target
                                    return resolveEnemyActions(applyEffects(newState, [{ type: 'Displacement', target: 'self', destination: pos }]));
                                } else {
                                    // Stop early due to hit
                                    return resolveEnemyActions(applyEffects(newState, [{ type: 'Displacement', target: 'self', destination: pos }]));
                                }
                            } else {
                                // Blocked!
                                return { ...s, message: [...s.message, "Blocked by enemy!"].slice(-50) };
                            }
                        }
                    }
                }

                // Standard single tile move or clear dash
                if (!isWalkable(target, s.wallPositions, s.lavaPositions, s.gridWidth, s.gridHeight)) {
                    return { ...s, message: [...s.message, "Blocked!"].slice(-50) };
                }

                if (isOccupied(target, s)) {
                    const targetEnemy = getEnemyAt(s.enemies, target);
                    if (targetEnemy && dist === 1) {
                        const basicAttackDef = COMPOSITIONAL_SKILLS['BASIC_ATTACK'];
                        const basicAttackSkill = s.player.activeSkills?.find(ss => ss.id === 'BASIC_ATTACK');

                        if (basicAttackDef && basicAttackSkill) {
                            const execution = basicAttackDef.execute(s, s.player, target, basicAttackSkill.activeUpgrades);
                            let newState = applyEffects(s, execution.effects, { targetId: targetEnemy.id });
                            newState.message = [...newState.message, ...execution.messages].slice(-50);
                            return resolveEnemyActions(newState);
                        }
                    }
                    return { ...clearedState, message: [...state.message, "Tile occupied!"].slice(-50) };
                }

                const moveEffects: AtomicEffect[] = [
                    { type: 'Displacement' as const, target: 'self', destination: target, source: s.player.position }
                ];

                return resolveEnemyActions(applyEffects(s, moveEffects, { targetId: s.player.id }));
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
        turn: state.turn,
        kills: state.kills,
        rngCounter: state.rngCounter
    };

    return JSON.stringify(obj);
};

