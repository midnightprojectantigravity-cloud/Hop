import type { GameState, Action, Point } from './types';
import { createRng } from './rng';
import { createHex, hexDistance, hexEquals, getGridCells } from './hex';
import { resolveTelegraphedAttacks, computeNextEnemies } from './combat';
import { INITIAL_PLAYER_STATS, ENEMY_STATS, GRID_RADIUS } from './constants';
import { applyLavaDamage, checkShrine, checkStairs } from './helpers';
import { increaseMaxHp } from './actor';


const createIdFromRng = (rng: ReturnType<typeof createRng>) => rng.id(9);

export const generateInitialState = (floor: number = 1, seed: string = String(Date.now()), initialSeed?: string): GameState => {
    const rng = createRng(seed);
    const cells = getGridCells(GRID_RADIUS);
    const stairsPos = cells[Math.floor(rng.next() * cells.length)];
    const lavaCount = 5 + Math.floor(rng.next() * 5);
    const lavaPositions: Point[] = [];

    // Position shrine every 2 floors
    let shrinePos: Point | undefined;
    if (floor % 2 === 0) {
        shrinePos = cells[Math.floor(rng.next() * cells.length)];
    }

    while (lavaPositions.length < lavaCount) {
        const potential = cells[Math.floor(rng.next() * cells.length)];
        const isSpecial = hexEquals(potential, createHex(0, 0)) ||
            hexEquals(potential, stairsPos) ||
            (shrinePos && hexEquals(potential, shrinePos));
        if (!isSpecial && !lavaPositions.some(lp => hexEquals(lp, potential))) {
            lavaPositions.push(potential);
        }
    }

    return {
        turn: 1,
        player: {
            id: 'player',
            type: 'player',
            position: createHex(0, 0),
            ...INITIAL_PLAYER_STATS
        },
        enemies: [
            {
                id: createIdFromRng(rng),
                type: 'enemy',
                subtype: 'footman',
                position: createHex(0, -2),
                ...ENEMY_STATS.footman
            },
            {
                id: createIdFromRng(rng),
                type: 'enemy',
                subtype: 'archer',
                position: createHex(2, 2),
                ...ENEMY_STATS.archer
            },
            {
                id: createIdFromRng(rng),
                type: 'enemy',
                subtype: 'bomber',
                position: createHex(-2, 0),
                ...ENEMY_STATS.bomber
            }
        ],
        gridRadius: GRID_RADIUS,
        gameStatus: 'playing',
        message: floor === 1 ? 'Welcome to the arena. Survive.' : `Floor ${floor}. Be careful.`,
        hasSpear: true,
    rngSeed: seed,
    initialSeed: initialSeed ?? (floor === 1 ? seed : undefined),
    rngCounter: 0,
        stairsPosition: stairsPos,
        lavaPositions,
        shrinePosition: shrinePos,
        floor: floor,
        upgrades: [],
        actionLog: []
    };
};

const resolveEnemyActions = (state: GameState, playerMovedTo: Point): GameState => {
    let player = state.player;
    const messages: string[] = [];

    // 1. Resolve existing telegraphed attacks (returns updated player)
    const tele = resolveTelegraphedAttacks(state, playerMovedTo);
    player = tele.player;
    messages.push(...tele.messages);

    // 2. Resolve Lava Damage for Player using helper (apply to updated player)
    const lavaResult = applyLavaDamage(state, playerMovedTo, player);
    player = lavaResult.player;
    messages.push(...lavaResult.messages);

    // 3. Enemies move or prepare next attack
    const nextEnemiesResult = computeNextEnemies(state, playerMovedTo);
    const nextEnemies = nextEnemiesResult.enemies;
    // update state in case computeNextEnemies consumed RNG in future
    state = { ...state, ...nextEnemiesResult.nextState };

    // Pick up spear if player moves onto it
    let hasSpear = state.hasSpear;
    let spearPos = state.spearPosition;
    if (spearPos && hexEquals(playerMovedTo, spearPos)) {
        hasSpear = true; spearPos = undefined;
        messages.push('Picked up your spear.');
    }

    // Check Shrine using helper
    if (checkShrine(state, playerMovedTo)) {
        return {
            ...state,
            player: { ...player, position: playerMovedTo },
            gameStatus: 'choosing_upgrade',
            message: 'A holy shrine! Choose an upgrade.'
        };
    }

    // Check for level progression
    // Check for level progression using helper
    if (checkStairs(state, playerMovedTo)) {
        // If we've reached the final arcade floor, end run and mark completedRun for leaderboard
        const arcadeMax = 5;
        if (state.floor >= arcadeMax) {
            // Use deterministic fallback when deriving completed run seed
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

        // Derive next-floor seed deterministically from current run seed (if any)
    const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
        const nextSeed = `${baseSeed}:${state.floor + 1}`;
        return generateInitialState(state.floor + 1, nextSeed, baseSeed);
    }

    return {
        ...state,
        enemies: nextEnemies,
        player: { ...player, position: playerMovedTo },
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
            const upgrade = action.payload;
            let player = state.player;
            if (upgrade === 'EXTRA_HP') {
                // Use actor helper to increase max HP and heal
                player = increaseMaxHp(player, 1, true);
            }
            return appendAction({
                ...state,
                player,
                upgrades: [...state.upgrades, upgrade],
                gameStatus: 'playing',
                message: `Applied ${upgrade}!`
            }, action);
        }
        case 'LEAP':
        case 'MOVE': {
            const target = action.payload;
            const dist = hexDistance(state.player.position, target);
            if (action.type === 'MOVE' && dist !== 1) return state;
            if (action.type === 'LEAP' && (dist > 2 || dist < 1)) return state;

            const killedEnemies = state.enemies.filter(e =>
                (hexDistance(state.player.position, e.position) === 2 && hexDistance(target, e.position) === 1)
            );

            return resolveEnemyActions(appendAction({ ...state, enemies: state.enemies.filter(e => !killedEnemies.includes(e)) }, action), target);
        }
        case 'THROW_SPEAR': {
            if (!state.hasSpear) return state;
            const target = action.payload;

            // Check if enemy at target
            const targetEnemy = state.enemies.find(e => hexEquals(e.position, target));

            return resolveEnemyActions(appendAction({
                ...state,
                enemies: state.enemies.filter(e => e.id !== targetEnemy?.id),
                hasSpear: false,
                spearPosition: target
            }, action), state.player.position);
        }
        case 'WAIT': {
            return resolveEnemyActions(appendAction(state, action), state.player.position);
        }
        default:
            return state;
    }
};
