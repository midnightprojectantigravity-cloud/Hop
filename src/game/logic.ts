import type { GameState, Action, Point } from './types';
import { hexDistance, hexEquals, getNeighbors } from './hex';
import { resolveTelegraphedAttacks, computeNextEnemies } from './combat';
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
import { applyEffects } from './effectEngine';


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
        hasShield: true,
        enemies: enemies.map(e => ({ ...e, previousPosition: e.position })),
        gridWidth: GRID_WIDTH,
        gridHeight: GRID_HEIGHT,
        gameStatus: 'playing',
        message: floor === 1
            ? ['Welcome to the arena. Survive.']
            : [...(preservePlayer as any)?.message || [], `Floor ${floor} - ${theme.charAt(0).toUpperCase() + theme.slice(1)}. Be careful.`].slice(-50),
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
        kills: preservePlayer ? (preservePlayer as any).kills || 0 : 0,
        environmentalKills: preservePlayer ? (preservePlayer as any).environmentalKills || 0 : 0,
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
    // Create a temporary state reflecting player's current status for enemy computations
    const stateAfterTelegraphAndLava = { ...state, player, enemies };
    const { enemies: nextEnemies, nextState: s3, messages: enemyMessages, dyingEntities } = computeNextEnemies(stateAfterTelegraphAndLava, playerMovedTo);
    enemies = nextEnemies;
    player = s3.player; // Player might have taken damage from bombs
    messages.push(...enemyMessages);

    // 4. Punch Passive: hit enemies that were adjacent at start and are still adjacent
    const neighbors = getNeighbors(playerMovedTo);
    let killsThisTurn = 0;
    enemies = enemies.map(e => {
        const prevPos = previousPositions.get(e.id);
        if (!prevPos) return e;

        const wasAdjacent = getNeighbors(state.player.position).some(n => hexEquals(n, prevPos));
        const isAdjacent = neighbors.some(n => hexEquals(n, e.position));

        if (wasAdjacent && isAdjacent) {
            messages.push(`Punched ${e.subtype}!`);
            const nextHp = e.hp - 1;
            if (nextHp <= 0) killsThisTurn++;
            return { ...e, hp: nextHp };
        }
        return e;
    }).filter(e => e.hp > 0);

    const totalKills = (state.kills || 0) + killsThisTurn;

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

    // Pick up shield if player moves onto it
    let hasShield = state.hasShield;
    let shieldPos = state.shieldPosition;
    if (shieldPos && hexEquals(playerMovedTo, shieldPos)) {
        hasShield = true; shieldPos = undefined;
        messages.push('Picked up your shield.');
    }

    // Update positions and turn state
    player = { ...player, previousPosition: playerMovedTo, position: playerMovedTo };
    enemies = enemies.map(e => ({ ...e, previousPosition: e.position }));

    // 5. Tick skill cooldowns and apply passives
    player = tickSkillCooldowns(player);
    player = applyPassiveSkills(player);

    // Check Shrine
    if (checkShrine(state, playerMovedTo)) {
        return {
            ...state,
            player: { ...player, position: playerMovedTo },
            gameStatus: 'choosing_upgrade',
            message: ['A holy shrine! Choose an upgrade.']
        };
    }

    // Check Stairs
    if (checkStairs(state, playerMovedTo)) {
        const arcadeMax = 10;
        if (state.floor >= arcadeMax) {
            const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
            const score = (totalKills * 10) + (state.environmentalKills * 25) + (state.floor * 100);
            return {
                ...state,
                player: { ...player, position: playerMovedTo },
                gameStatus: 'won',
                message: ['You cleared the arcade! Submit your run to the leaderboard.'],
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

        // Restore 1 HP on floor progression (max 1 beyond current HP, respecting maxHp)
        const nextHp = Math.min(player.maxHp, player.hp + 1);

        return generateInitialState(state.floor + 1, nextSeed, baseSeed, {
            hp: nextHp,
            maxHp: player.maxHp,
            upgrades: state.upgrades,
            activeSkills: player.activeSkills,
            kills: totalKills,
            environmentalKills: state.environmentalKills,
        } as any);
    }

    return {
        ...state,
        enemies: enemies.map(e => ({ ...e, previousPosition: previousPositions.get(e.id) || e.position })),
        player: { ...player, previousPosition: state.player.position },
        hasSpear,
        spearPosition: spearPos,
        turn: state.turn + 1,
        message: [...state.message, ...(messages.length > 0 ? messages : ['Enemy turn over.'])].slice(-50),
        gameStatus: player.hp <= 0 ? 'lost' : 'playing',
        kills: totalKills,
        environmentalKills: state.environmentalKills,
        dyingEntities: dyingEntities, // Show lava sinks/explosions
        isShaking: state.isShaking || false,   // Preserve shake if triggered by skill
        lastSpearPath: undefined // Clear trail
    };
};

export const gameReducer = (state: GameState, action: Action): GameState => {
    // Record action into actionLog when game is playing (or even when ended for full trace)
    const appendAction = (s: GameState, a: Action): GameState => {
        const log = s.actionLog ? [...s.actionLog, a] : [a];
        return { ...s, actionLog: log };
    };

    if (state.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE') return state;

    // Clear transient visual flags when player starts a NEW action
    const clearedState = {
        ...state,
        isShaking: false,
        lastSpearPath: undefined,
        dyingEntities: []
    };

    switch (action.type) {
        case 'LOAD_STATE':
            return action.payload;
        case 'RESET':
            return generateInitialState(1, String(Date.now()));
    }

    if (state.gameStatus !== 'playing' && action.type !== 'SELECT_UPGRADE') return state;

    switch (action.type) {
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
                ...clearedState,
                player,
                upgrades: [...state.upgrades, upgradeId],
                gameStatus: 'playing',
                shrinePosition: undefined,
                message: [...state.message, `Gained ${upgradeDef?.name || upgradeId}!`].slice(-50)
            }, action);
        }

        case 'USE_SKILL': {
            const { skillId, target } = action.payload;

            // Check if player has the skill and it's ready
            // Special handling for LUNGE which is an upgrade, not a standalone skill
            const isLunge = skillId === 'LUNGE';
            const skill = isLunge
                ? state.player.activeSkills?.find(s => s.id === 'SPEAR_THROW')
                : state.player.activeSkills?.find(s => s.id === skillId);

            if (!isLunge && (!skill || skill.currentCooldown > 0)) {
                return { ...clearedState, message: [...state.message, skill ? 'Skill on cooldown!' : 'You don\'t have this skill!'].slice(-50) };
            }

            // Check if player has LUNGE upgrade for lunge action
            if (isLunge && !hasUpgrade(state.player, 'SPEAR_THROW', 'LUNGE')) {
                return { ...clearedState, message: [...state.message, 'You don\'t have the Lunge upgrade!'].slice(-50) };
            }

            // Route to appropriate skill executor
            // 1. Check Compositional Skill Registry
            const compDef = COMPOSITIONAL_SKILLS[skillId];
            if (compDef) {
                const targetEnemy = target ? getEnemyAt(state.enemies, target) : undefined;
                const activeUpgrades = skill?.activeUpgrades || [];
                const execution = compDef.execute(state, state.player, target, activeUpgrades);

                // Apply effects to state
                let newState = applyEffects(clearedState, execution.effects, { targetId: targetEnemy?.id });

                // Update cooldown for the skill just used
                newState.player = {
                    ...newState.player,
                    activeSkills: newState.player.activeSkills?.map((s: any) =>
                        s.id === skillId ? { ...s, currentCooldown: compDef.baseVariables.cooldown } : s
                    )
                };

                // Check if any Displacement effect moved the player
                const playerMoveEffect = execution.effects.find(e => e.type === 'Displacement' && e.target === 'self') as { type: 'Displacement', destination: Point } | undefined;
                const playerMovedTo = playerMoveEffect ? playerMoveEffect.destination : newState.player.position;

                const stateAfterSkill = appendAction({
                    ...newState,
                    message: [...newState.message, ...execution.messages].slice(-50)
                }, action);

                if (execution.consumesTurn === false) {
                    return stateAfterSkill;
                }

                return resolveEnemyActions(stateAfterSkill, playerMovedTo);
            }

            // 2. Legacy Skill Handling
            let result;
            switch (skillId) {
                case 'SPEAR_THROW':
                    if (!target) return { ...clearedState, message: [...state.message, 'Select target for Spear Throw!'].slice(-50) };
                    result = executeSpearThrow(target, state);
                    break;
                case 'SHIELD_BASH':
                    if (!target) return { ...clearedState, message: [...state.message, 'Select target for Shield Bash!'].slice(-50) };
                    result = executeShieldBash(target, state);
                    break;
                case 'JUMP':
                    if (!target) return { ...clearedState, message: [...state.message, 'Select target for Jump!'].slice(-50) };
                    result = executeJump(target, state);
                    break;
                case 'LUNGE':
                    if (!target) return { ...clearedState, message: [...state.message, 'Select target for Lunge!'].slice(-50) };
                    result = executeLunge(target, state);
                    break;
                default:
                    return { ...clearedState, message: [...state.message, `Unknown skill: ${skillId}`].slice(-50) };
            }


            // Apply any lava created by skill
            let newLavaPositions = state.lavaPositions;
            if (result.lavaCreated && result.lavaCreated.length > 0) {
                newLavaPositions = [...state.lavaPositions, ...result.lavaCreated];
            }

            // If skill doesn't consume turn (e.g., FREE_JUMP), don't resolve enemy actions
            if (result.consumesTurn === false) {
                return appendAction({
                    ...clearedState,
                    player: result.player,
                    enemies: result.enemies,
                    lavaPositions: newLavaPositions,
                    message: [...state.message, ...result.messages].slice(-50),
                    environmentalKills: (state.environmentalKills || 0) + (result.environmentalKills || 0),
                    kills: (state.kills || 0) + (result.kills || 0),
                    lastSpearPath: result.lastSpearPath,
                    isShaking: result.isShaking,
                    dyingEntities: []
                }, action);
            }

            // Resolve enemy actions after skill use
            return resolveEnemyActions(appendAction({
                ...clearedState,
                player: result.player,
                enemies: result.enemies,
                lavaPositions: newLavaPositions,
                message: [...state.message, ...result.messages].slice(-50),
                environmentalKills: (state.environmentalKills || 0) + (result.environmentalKills || 0),
                kills: (state.kills || 0) + (result.kills || 0),
                lastSpearPath: result.lastSpearPath,
                isShaking: result.isShaking,
                dyingEntities: []
            }, action), result.playerMoved || state.player.position);
        }

        case 'MOVE':
        case 'LEAP':
        case 'JUMP': {
            const target = action.payload;
            const dist = hexDistance(state.player.position, target);
            if (action.type === 'MOVE' && dist !== 1) return clearedState;
            if ((action.type === 'LEAP' || action.type === 'JUMP') && (dist > 2 || dist < 1)) return clearedState;

            // Check walkability (Walls/Lava)
            if (!isWalkable(target, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight)) {
                return { ...clearedState, message: [...state.message, "Blocked!"].slice(-50) };
            }

            // Check occupancy (cant step on enemies/self)
            if (isOccupied(target, state)) {
                // If it's an enemy, maybe we should attack? 
                const targetEnemy = getEnemyAt(state.enemies, target);
                if (targetEnemy && action.type === 'MOVE') {
                    // One-hit kill melee attack by moving into them (classic Hoplite)
                    return resolveEnemyActions(appendAction({
                        ...clearedState,
                        enemies: state.enemies.filter(e => e.id !== targetEnemy.id),
                        message: [...state.message, `Struck ${targetEnemy.subtype}!`].slice(-50),
                        dyingEntities: [targetEnemy]
                    }, action), state.player.position);
                }
                return { ...clearedState, message: [...state.message, "Tile occupied!"].slice(-50) };
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
            const target = action.payload;
            const result = executeSpearThrow(target, state);

            if (result.messages.includes('Spear not in hand!') || result.messages.includes('Target out of range!')) {
                return { ...clearedState, message: [...state.message, result.messages[0]].slice(-50) };
            }

            return resolveEnemyActions(appendAction({
                ...clearedState,
                enemies: result.enemies,
                hasSpear: result.hasSpear ?? false,
                spearPosition: result.spearPosition,
                message: [...state.message, ...result.messages].slice(-50),
                kills: (state.kills || 0) + (result.kills || 0),
                lastSpearPath: result.lastSpearPath,
                isShaking: result.isShaking,
                dyingEntities: []
            }, action), state.player.position);
        }

        case 'WAIT': {
            return resolveEnemyActions(appendAction(clearedState, action), state.player.position);
        }

        default:
            return state;
    }
};
