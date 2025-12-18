import type { GameState, Action } from './types';
import { createHex, hexDistance, hexEquals, getNeighbors } from './hex';
import { INITIAL_PLAYER_STATS, ENEMY_STATS, GRID_RADIUS } from './constants';

const createId = () => Math.random().toString(36).substr(2, 9);

export const generateInitialState = (): GameState => {
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
                id: createId(),
                type: 'enemy',
                subtype: 'footman',
                position: createHex(0, -2), // Start a bit away
                ...ENEMY_STATS.footman
            },
            {
                id: createId(),
                type: 'enemy',
                subtype: 'footman',
                position: createHex(2, 2),
                ...ENEMY_STATS.footman
            }
        ],
        gridRadius: GRID_RADIUS,
        gameStatus: 'playing',
        message: 'Welcome to the arena. Survive.'
    };
};

const resolveEnemyActions = (state: GameState): GameState => {
    // Enemies move towards player or attack
    const newEnemies = state.enemies.map(bt => {
        const dist = hexDistance(bt.position, state.player.position);

        // Simple AI: If adjacent, attack (deal damage). Else, move closer.
        if (dist === 1) {
            // Attack logic would go here. For now, we assume they hit if adjacent at end of turn?
            // In Hoplite, enemies telegraph attacks.
            // Let's implement: If adjacent, they attacked THIS turn.
            return { ...bt, intent: 'Attacking!' };
        } else {
            // Move 1 step closer
            // Find neighbor closest to player
            const neighbors = getNeighbors(bt.position);
            let bestMove = bt.position;
            let minDst = dist;

            for (const n of neighbors) {
                const d = hexDistance(n, state.player.position);
                // Check collision with other enemies
                const blocked = state.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n));
                if (d < minDst && !blocked && !hexEquals(n, state.player.position)) { // Don't move on top of player
                    minDst = d;
                    bestMove = n;
                }
            }
            return { ...bt, position: bestMove, intent: 'Moving' };
        }
    });

    // Check for damage to player
    let playerHp = state.player.hp;
    newEnemies.forEach(e => {
        if (hexDistance(e.position, state.player.position) === 1) {
            // In casual Hoplite, moving next to enemy usually risk being hit next turn.
            // We'll simplify: If you end turn next to enemy, you take damage.
            playerHp -= 1;
        }
    });

    return {
        ...state,
        enemies: newEnemies,
        player: { ...state.player, hp: playerHp },
        turn: state.turn + 1,
        message: playerHp < state.player.hp ? 'Took damage!' : 'Enemy turn over.'
    };
};

export const gameReducer = (state: GameState, action: Action): GameState => {
    if (state.gameStatus !== 'playing' && action.type !== 'RESET') return state;

    switch (action.type) {
        case 'RESET':
            return generateInitialState();
        case 'MOVE': {
            const target = action.payload;
            // Validate move: distance 1, inside grid
            if (hexDistance(state.player.position, target) !== 1) return state;

            // Check if occupied by enemy -> Attack instead?
            const enemyAtTarget = state.enemies.find(e => hexEquals(e.position, target));
            if (enemyAtTarget) {
                // Attack logic (kill enemy)
                // Then player moves there? Or stays? In Hoplite, you lunge or jump.
                // Let's say: Move onto enemy = Kill enemy + Move there.
                const newEnemies = state.enemies.filter(e => e.id !== enemyAtTarget.id);
                const intermediateState = {
                    ...state,
                    player: { ...state.player, position: target },
                    enemies: newEnemies,
                    message: `Killed ${enemyAtTarget.subtype}!`
                };
                // Then enemies act
                return resolveEnemyActions(intermediateState);
            }

            // Normal move
            const intermediateState = {
                ...state,
                player: { ...state.player, position: target },
                message: 'Moved.'
            };
            return resolveEnemyActions(intermediateState);
        }
        case 'WAIT': {
            return resolveEnemyActions(state);
        }
        default:
            return state;
    }
};
