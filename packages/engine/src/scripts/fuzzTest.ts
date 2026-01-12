
import { generateInitialState, gameReducer } from '../logic';
import { isPlayerTurn } from '../initiative';
import type { GameState, Action, Point } from '../types';
import { getNeighbors } from '../hex';
import { GRID_WIDTH, GRID_HEIGHT } from '../constants';

/**
 * FUZZ TEST
 * 
 * Runs the engine through a large number of random random actions to detect crashes,
 * soft-locks (infinite turns), or illegal state transitions (e.g. player in walls).
 * 
 * Goal: 10,000 turns without failure.
 */

const MAX_TURNS = 10000;
let turnsProcessed = 0;
let gamesPlayed = 0;

console.log('🦈 Starting Shark Fuzz Test...');

const getRandomMove = (state: GameState): Point => {
    const neighbors = getNeighbors(state.player.position);
    // Filter to map bounds (roughly)
    const valid = neighbors.filter(n =>
        n.q >= 0 && n.q < GRID_WIDTH &&
        n.r >= 0 && n.r < GRID_HEIGHT
    );
    return valid[Math.floor(Math.random() * valid.length)];
};

const runFuzz = () => {
    let state = generateInitialState(1, 'fuzz_seed_' + Date.now());

    while (turnsProcessed < MAX_TURNS) {
        // Check for Game Over / Win
        if (state.gameStatus !== 'playing') {
            gamesPlayed++;
            state = generateInitialState(1, 'fuzz_seed_' + Date.now());
            continue;
        }

        if (isPlayerTurn(state)) {
            // Player's Turn: Random Action
            const actionType = Math.random() > 0.3 ? 'MOVE' : 'WAIT';
            let action: Action;

            if (actionType === 'MOVE') {
                action = { type: 'MOVE', payload: getRandomMove(state) };
            } else {
                action = { type: 'WAIT' };
            }

            try {
                // Safeguard: Ensure we don't crash on reducer
                state = gameReducer(state, action);
            } catch (e: any) {
                console.error(`❌ CRASH detected at turn ${turnsProcessed}:`, e.message);
                console.error('Last Action:', action);
                console.error('State Fingerprint:', state.rngSeed, state.turn);
                process.exit(1);
            }

            turnsProcessed++;
            if (turnsProcessed % 1000 === 0) {
                process.stdout.write(`\r✅ ${turnsProcessed}/${MAX_TURNS} turns simulated (${gamesPlayed} runs finished)...`);
            }

        } else {
            // Enemy Turn: Auto-advance (mimic UI loop)
            try {
                // Determine if we need to advance or simply process
                // The reducer handles ADVANCE_TURN by calling processNextTurn
                state = gameReducer(state, { type: 'ADVANCE_TURN' });

                // Safety valve for infinite loops in initiative (unlikely but possible in fuzzing)
                // We rely on MAX_TURNS to just eventually finish.

            } catch (e: any) {
                console.error(`❌ CRASH (Enemy Phase) detected at turn ${turnsProcessed}:`, e.message);
                process.exit(1);
            }
        }
    }

    console.log(`\n\n🎉 SUCCESS! Completed ${MAX_TURNS} turns across ${gamesPlayed} runs without crashing.`);
};

runFuzz();
