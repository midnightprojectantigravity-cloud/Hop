/**
 * CORE ENGINE LOGIC
 * Follows the Command Pattern & Immutable State.
 * resolveEnemyActions and gameReducer are the primary entry points.
 * TODO: Migrate all remaining legacy skills (Spear/Shield/Jump) to the Compositional Framework.
 */
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
import { applyAutoAttack } from './skills/auto_attack';
import { refreshOccupancyMask } from './spatial';
import { createCommand, createDelta } from './commands';


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
    } : INITIAL_PLAYER_STATS;

    const upgrades = preservePlayer?.upgrades || (loadout ? loadout.startingUpgrades : []);
    const activeSkills = preservePlayer?.activeSkills || (loadout ? applyLoadoutToPlayer(loadout).activeSkills : createDefaultSkills());

    // Use the fixed playerSpawn from dungeon generation
    const playerPos = dungeon.playerSpawn;

    const initialState: GameState = {
        turn: 1,
        player: {
            id: 'player',
            type: 'player',
            position: playerPos,
            previousPosition: playerPos,
            ...playerStats,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills,
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
        upgrades,
        commandLog: [],
        undoStack: [],
        actionLog: [],
        rooms: dungeon.rooms,
        theme,
        kills: preservePlayer ? (preservePlayer as any).kills || 0 : 0,
        environmentalKills: preservePlayer ? (preservePlayer as any).environmentalKills || 0 : 0,
        turnsSpent: preservePlayer ? (preservePlayer as any).turnsSpent || 0 : 0,
        visualEvents: [],
    };

    initialState.occupancyMask = refreshOccupancyMask(initialState);

    return initialState;
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

    // 4. Auto Attack (Punch Passive): Use the skill system if player has AUTO_ATTACK
    const previousNeighbors = getNeighbors(state.player.position);
    let intermediateState = { ...state, player: { ...player, position: playerMovedTo }, enemies };
    const autoAttackResult = applyAutoAttack(intermediateState, player, previousNeighbors);
    enemies = autoAttackResult.state.enemies;
    messages.push(...autoAttackResult.messages);
    const killsThisTurn = autoAttackResult.kills;

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
        // Use consumeRandom for deterministic selection of upgrade options
        const allUpgrades = Object.keys(UPGRADE_DEFINITIONS);
        const available = allUpgrades.filter(u => !state.upgrades.includes(u));

        const picked: string[] = [];
        let rngState = { ...state }; // Snapshot for RNG purposes

        for (let i = 0; i < 3 && available.length > 0; i++) {
            const res = consumeRandom(rngState);
            rngState = res.nextState; // Advance RNG
            const idx = Math.floor(res.value * available.length);
            picked.push(available[idx]);
            available.splice(idx, 1);
        }

        return {
            ...state, // Base on original state? No, we need Player/Enemies updates.
            // We need to merge everything.
            player: { ...player, position: playerMovedTo },
            enemies: enemies, // Updated enemies
            rngCounter: rngState.rngCounter, // KEEP THE RNG ADVANCEMENT!
            gameStatus: 'choosing_upgrade',
            shrineOptions: picked.length > 0 ? picked : ['EXTRA_HP'],
            message: ['A holy shrine! Choose an upgrade.']
        };
    }

    // Check Stairs
    if (checkStairs(state, playerMovedTo)) {
        const arcadeMax = 10;
        if (state.floor >= arcadeMax) {
            const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
            const speedBonus = Math.max(0, (state.floor * 30 - state.turnsSpent) * 50);
            const damagePenalty = (player.maxHp - player.hp) * 10;
            const score = (state.floor * 1000) + speedBonus - damagePenalty;

            return {
                ...state,
                player: { ...player, position: playerMovedTo },
                gameStatus: 'won',
                message: [`Arcade Cleared! Final Score: ${score}`],
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
        hasShield,
        shieldPosition: shieldPos,
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
                    return resolveEnemyActions(stateAfterSkill, playerMovedTo);
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
                }, result.playerMoved || s.player.position);
            }

            case 'MOVE':
            case 'LEAP':
            case 'JUMP': {
                if (!('payload' in a)) return s;
                const target = a.payload;
                const dist = hexDistance(s.player.position, target);
                if (a.type === 'MOVE' && dist !== 1) return s;
                if ((a.type === 'LEAP' || a.type === 'JUMP') && (dist > 2 || dist < 1)) return s;

                if (!isWalkable(target, s.wallPositions, s.lavaPositions, s.gridWidth, s.gridHeight)) {
                    return { ...s, message: [...s.message, "Blocked!"].slice(-50) };
                }

                if (isOccupied(target, s)) {
                    const targetEnemy = getEnemyAt(s.enemies, target);
                    if (targetEnemy && a.type === 'MOVE') {
                        const basicAttackDef = COMPOSITIONAL_SKILLS['BASIC_ATTACK'];
                        const basicAttackSkill = s.player.activeSkills?.find(s => s.id === 'BASIC_ATTACK');

                        if (basicAttackDef && basicAttackSkill) {
                            const execution = basicAttackDef.execute(s, s.player, target, basicAttackSkill.activeUpgrades);

                            // Apply effects from basic attack
                            let newState = applyEffects(s, execution.effects, { targetId: targetEnemy.id });

                            return resolveEnemyActions({
                                ...newState,
                                message: [...newState.message, ...execution.messages].slice(-50)
                            }, s.player.position);
                        } else {
                            // Fallback to legacy "kill instantly" if skill is missing (shouldn't happen with default setup)
                            return resolveEnemyActions({
                                ...s,
                                enemies: s.enemies.filter(e => e.id !== targetEnemy.id),
                                message: [...s.message, `Struck ${targetEnemy.subtype}!`].slice(-50),
                                dyingEntities: [targetEnemy]
                            }, s.player.position);
                        }
                    }
                    return { ...clearedState, message: [...state.message, "Tile occupied!"].slice(-50) };
                }

                const killedEnemies = (a.type === 'LEAP' || a.type === 'JUMP')
                    ? s.enemies.filter(e =>
                        (hexDistance(s.player.position, e.position) === 2 && hexDistance(target, e.position) === 1)
                    )
                    : [];

                return resolveEnemyActions({ ...s, enemies: s.enemies.filter(e => !killedEnemies.includes(e)) }, target);
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
                }, s.player.position);
            }

            case 'WAIT': {
                return resolveEnemyActions(s, s.player.position);
            }

            default:
                return s;
        }
    };

    intermediateState = resolveGameState(clearedState, action);

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
