import type { GameState, Action, Point } from './types';
import { hexDistance, hexEquals, getNeighbors } from './hex';
import { resolveTelegraphedAttacks, computeNextEnemies } from './combat';
import { INITIAL_PLAYER_STATS } from './constants';
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
} from './skills';

/**
 * Generate initial state with the new tactical arena generation
 */
export const generateInitialState = (
    floor: number = 1,
    seed: string = String(Date.now()),
    initialSeed?: string,
    preservePlayer?: { hp: number; maxHp: number; upgrades: string[]; activeSkills?: any[] }
): GameState => {
    // Determine floor theme
    const theme = getFloorTheme(floor);

    // Use tactical arena generation for all floors
    const dungeon = generateDungeon(floor, seed);
    const enemies = generateEnemies(floor, dungeon.spawnPositions, seed);

    // Build player state (preserve HP/upgrades/skills across floors)
    const playerStats = preservePlayer ? {
        hp: preservePlayer.hp,
        maxHp: preservePlayer.maxHp,
    } : INITIAL_PLAYER_STATS;

    const upgrades = preservePlayer?.upgrades || [];
    const activeSkills = preservePlayer?.activeSkills || createDefaultSkills();

    // Use the fixed playerSpawn from dungeon generation
    const playerPos = dungeon.playerSpawn;

    return {
        turn: 1,
        player: {
            id: 'player',
            type: 'player',
            position: playerPos,
            previousPosition: playerPos,
            ...playerStats,
            activeSkills,
        },
        enemies: enemies.map(e => ({ ...e, previousPosition: e.position })),
        gridRadius: 5, // Legacy support
        gameStatus: 'playing',
        message: floor === 1
            ? 'Welcome to the arena. Survive.'
            : `Floor ${floor} - ${theme.charAt(0).toUpperCase() + theme.slice(1)}. Be careful.`,
        hasSpear: true,
        rngSeed: seed,
        initialSeed: initialSeed ?? (floor === 1 ? seed : undefined),
        rngCounter: 0,
        stairsPosition: dungeon.stairsPosition,
        lavaPositions: dungeon.lavaPositions,
        wallPositions: dungeon.wallPositions,
        shrinePosition: dungeon.shrinePosition,
        floor: floor,
        upgrades,
        actionLog: [],
        rooms: dungeon.rooms,
        theme,
    };
};

const resolveEnemyActions = (state: GameState, playerMovedTo: Point): GameState => {
    let player = state.player;
    let enemies = state.enemies;
    const messages: string[] = [];

    // Store previous positions for Punch passive
    const previousPositions = new Map<string, Point>();
    enemies.forEach(e => previousPositions.set(e.id, e.position));

    // 1. Resolve existing telegraphed attacks
    // Special: Check if blocking (from intent system)
    const isBlocking = player.intent === 'Blocking';
    const tele = resolveTelegraphedAttacks(state, playerMovedTo);

    if (isBlocking && tele.messages.length > 0) {
        messages.push('Shield blocked the attack!');
        player = { ...tele.player, intent: undefined, hp: player.hp }; // Don't take damage if blocked
    } else {
        player = tele.player;
        messages.push(...tele.messages);
    }

    // 2. Resolve Lava Damage for Player
    const lavaRes = applyLavaDamage(state, playerMovedTo, player);
    player = lavaRes.entity;
    messages.push(...lavaRes.messages);

    // 3. Enemies move or prepare next attack
    const nextResult = computeNextEnemies(state, playerMovedTo);
    enemies = nextResult.enemies;
    state = { ...state, ...nextResult.nextState };

    // 4. Punch Passive: hit enemies that were adjacent at start and are still adjacent
    const neighbors = getNeighbors(playerMovedTo);
    enemies = enemies.map(e => {
        const prevPos = previousPositions.get(e.id);
        if (!prevPos) return e;

        const wasAdjacent = getNeighbors(state.player.position).some(n => hexEquals(n, prevPos));
        const isAdjacent = neighbors.some(n => hexEquals(n, e.position));

        if (wasAdjacent && isAdjacent) {
            messages.push(`Punched ${e.subtype}!`);
            return { ...e, hp: e.hp - 1 };
        }
        return e;
    }).filter(e => e.hp > 0);

    // Pick up spear if player moves onto it
    let hasSpear = state.hasSpear;
    let spearPos = state.spearPosition;
    if (spearPos && hexEquals(playerMovedTo, spearPos)) {
        hasSpear = true; spearPos = undefined;
        messages.push('Picked up your spear.');

        // Cleave upgrade: Picking up spear hits all adjacent
        if (player.activeSkills?.some(s => s.id === 'SPEAR_THROW' && s.activeUpgrades.includes('CLEAVE'))) {
            const adj = getNeighbors(playerMovedTo);
            enemies = enemies.map(e => {
                if (adj.some(a => hexEquals(a, e.position))) {
                    messages.push(`Cleave hit ${e.subtype}!`);
                    return { ...e, hp: e.hp - 1 };
                }
                return e;
            }).filter(e => e.hp > 0);
        }
    }

    // Update positions and turn state
    player = { ...player, previousPosition: playerMovedTo, position: playerMovedTo };
    enemies = enemies.map(e => ({ ...e, previousPosition: e.position }));

    // 5. Tick skill cooldowns
    player = tickSkillCooldowns(player);

    // Check Shrine
    if (checkShrine(state, playerMovedTo)) {
        return {
            ...state,
            player: { ...player, position: playerMovedTo },
            gameStatus: 'choosing_upgrade',
            message: 'A holy shrine! Choose an upgrade.'
        };
    }

    // Check Stairs
    if (checkStairs(state, playerMovedTo)) {
        const arcadeMax = 10;
        if (state.floor >= arcadeMax) {
            const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
            const score = (player.hp || 0) + (state.floor || 0) * 100;
            return {
                ...state,
                player: { ...player, position: playerMovedTo },
                gameStatus: 'won',
                message: 'You cleared the arcade! Submit your run to the leaderboard.',
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

        return generateInitialState(state.floor + 1, nextSeed, baseSeed, {
            hp: player.hp,
            maxHp: player.maxHp,
            upgrades: state.upgrades,
            activeSkills: player.activeSkills,
        });
    }

    return {
        ...state,
        enemies,
        player,
        hasSpear,
        spearPosition: spearPos,
        turn: state.turn + 1,
        message: messages.join(' ') || 'Enemy turn over.',
        gameStatus: player.hp <= 0 ? 'lost' : 'playing'
    };
};

export const gameReducer = (state: GameState, action: Action): GameState => {
    // Record action into actionLog when game is playing (or even when ended for full trace)
    const appendAction = (s: GameState, a: Action): GameState => {
        const log = s.actionLog ? [...s.actionLog, a] : [a];
        return { ...s, actionLog: log };
    };

    if (state.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE') return state;

    switch (action.type) {
        case 'LOAD_STATE': {
            return action.payload;
        }
        case 'RESET':
            // Create a fresh seeded run on reset
            return generateInitialState(1, String(Date.now()));

        case 'SELECT_UPGRADE': {
            const upgradeId = action.payload;
            let player = state.player;

            const upgradeDef = UPGRADE_DEFINITIONS[upgradeId];
            if (upgradeDef) {
                // It's a skill upgrade
                player = addUpgrade(player, upgradeDef.skill, upgradeId);
            } else if (upgradeId === 'EXTRA_HP') {
                player = increaseMaxHp(player, 1, true);
            }

            return appendAction({
                ...state,
                player,
                upgrades: [...state.upgrades, upgradeId],
                gameStatus: 'playing',
                shrinePosition: undefined,
                message: `Gained ${upgradeDef?.name || upgradeId}!`
            }, action);
        }

        case 'USE_SKILL': {
            const { skillId, target } = action.payload;

            // Check if player has the skill and it's ready
            const skill = state.player.activeSkills?.find(s => s.id === skillId);
            if (!skill || skill.currentCooldown > 0) {
                return { ...state, message: skill ? 'Skill on cooldown!' : 'You don\'t have this skill!' };
            }

            // Route to appropriate skill executor
            let result;
            switch (skillId) {
                case 'SHIELD_BASH':
                    if (!target) return { ...state, message: 'Select target for Shield Bash!' };
                    result = executeShieldBash(target, state);
                    break;
                case 'JUMP':
                    if (!target) return { ...state, message: 'Select target for Jump!' };
                    result = executeJump(target, state);
                    break;
                default:
                    return { ...state, message: `Unknown skill: ${skillId}` };
            }

            // Apply any lava created by skill
            let newLavaPositions = state.lavaPositions;
            if (result.lavaCreated && result.lavaCreated.length > 0) {
                newLavaPositions = [...state.lavaPositions, ...result.lavaCreated];
            }

            // If skill doesn't consume turn (e.g., FREE_JUMP), don't resolve enemy actions
            if (result.consumesTurn === false) {
                return appendAction({
                    ...state,
                    player: result.player,
                    enemies: result.enemies,
                    lavaPositions: newLavaPositions,
                    message: result.messages.join(' ')
                }, action);
            }

            // Resolve enemy actions after skill use
            return resolveEnemyActions(appendAction({
                ...state,
                player: result.player,
                enemies: result.enemies,
                lavaPositions: newLavaPositions,
                message: result.messages.join(' ')
            }, action), result.playerMoved || state.player.position);
        }

        case 'MOVE':
        case 'LEAP':
        case 'JUMP': {
            const target = action.payload;
            const dist = hexDistance(state.player.position, target);
            if (action.type === 'MOVE' && dist !== 1) return state;
            if ((action.type === 'LEAP' || action.type === 'JUMP') && (dist > 2 || dist < 1)) return state;

            // Check walkability (Walls/Lava)
            if (!isWalkable(target, state.wallPositions, state.lavaPositions)) {
                return { ...state, message: "Blocked!" };
            }

            // Check occupancy (cant step on enemies/self)
            if (isOccupied(target, state)) {
                // If it's an enemy, maybe we should attack? 
                const targetEnemy = getEnemyAt(state.enemies, target);
                if (targetEnemy && action.type === 'MOVE') {
                    // One-hit kill melee attack by moving into them (classic Hoplite)
                    return resolveEnemyActions(appendAction({
                        ...state,
                        enemies: state.enemies.filter(e => e.id !== targetEnemy.id),
                        message: `Struck ${targetEnemy.subtype}!`
                    }, action), state.player.position);
                }
                return { ...state, message: "Tile occupied!" };
            }

            // Leap Strike (kills enemies you jump over or land adjacent to if jumped from 2 away)
            // Simplified: in original Leap, jumping over an enemy kills it.
            const killedEnemies = (action.type === 'LEAP' || action.type === 'JUMP')
                ? state.enemies.filter(e =>
                    (hexDistance(state.player.position, e.position) === 2 && hexDistance(target, e.position) === 1)
                )
                : [];

            return resolveEnemyActions(appendAction({ ...state, enemies: state.enemies.filter(e => !killedEnemies.includes(e)) }, action), target);
        }

        case 'THROW_SPEAR': {
            if (!state.hasSpear) return state;
            const target = action.payload;

            // Check if enemy at target
            const targetEnemy = getEnemyAt(state.enemies, target);

            // Check for precision strike (double damage)
            const isPrecision = state.player.intent === 'Focused';
            let enemiesAfter = state.enemies;

            if (targetEnemy) {
                if (isPrecision) {
                    // Double damage kills most enemies outright
                    enemiesAfter = state.enemies.filter(e => e.id !== targetEnemy.id);
                } else {
                    enemiesAfter = state.enemies.filter(e => e.id !== targetEnemy.id);
                }
            }

            return resolveEnemyActions(appendAction({
                ...state,
                enemies: enemiesAfter,
                hasSpear: false,
                spearPosition: target,
                player: isPrecision ? { ...state.player, intent: undefined } : state.player
            }, action), state.player.position);
        }

        case 'WAIT': {
            return resolveEnemyActions(appendAction(state, action), state.player.position);
        }

        default:
            return state;
    }
};
