import { generateInitialState, gameReducer } from '@hop/engine/logic';
import type { GameState, Action, Point } from '@hop/engine/types';
import { DEFAULT_LOADOUTS } from '@hop/engine/loadout';

/**
 * Goal 4: Behavioral Fuzz Testing
 * Automated script that performs random actions to find edge cases.
 */

const MAX_TURNS = 100;
const TRIALS = 10;
const LOADOUT_IDS = Object.keys(DEFAULT_LOADOUTS);

const getRandomPosition = (state: GameState): Point => {
    const q = Math.floor(Math.random() * state.gridWidth);
    const r = Math.floor(Math.random() * state.gridHeight);
    return { q, r, s: -q - r };
};

const runFuzzTest = () => {
    console.log(`Starting Fuzz Test: ${TRIALS} trials, ${MAX_TURNS} turns max per trial...`);

    for (let i = 0; i < TRIALS; i++) {
        const loadout = DEFAULT_LOADOUTS[LOADOUT_IDS[Math.floor(Math.random() * LOADOUT_IDS.length)] as keyof typeof DEFAULT_LOADOUTS];
        let state = generateInitialState(1, `fuzz_seed_${i}`, undefined, undefined, loadout);
        console.log(`Trial ${i + 1} starting with loadout: ${loadout.name}...`);

        for (let turn = 0; turn < MAX_TURNS; turn++) {
            if (state.gameStatus !== 'playing') {
                console.log(`  Trial ${i + 1} ended at turn ${turn} with status ${state.gameStatus}`);
                break;
            }

            // Generate a random valid action
            const possibleActions: Action[] = [
                { type: 'WAIT' },
                { type: 'MOVE', payload: getRandomPosition(state) },
            ];

            // Add available skills
            state.player.activeSkills.forEach(skill => {
                if (skill.currentCooldown === 0) {
                    possibleActions.push({
                        type: 'USE_SKILL',
                        payload: { skillId: skill.id, target: getRandomPosition(state) }
                    });
                }
            });

            const action = possibleActions[Math.floor(Math.random() * possibleActions.length)];

            try {
                state = gameReducer(state, action);

                // Invariants checking
                if (state.player.hp < 0) throw new Error("Invariant Violation: Negative HP");
                if (state.player.hp > state.player.maxHp) throw new Error("Invariant Violation: Overhealed");
                if (isNaN(state.player.position.q) || isNaN(state.player.position.r)) throw new Error("Invariant Violation: NaN position");

                // Check for duplicate entities
                const ids = new Set();
                state.enemies.forEach(e => {
                    if (ids.has(e.id)) throw new Error(`Invariant Violation: Duplicate enemy ID ${e.id}`);
                    ids.add(e.id);
                });

            } catch (err) {
                console.error(`!!! CRASH or INVARIANT FAILURE in Trial ${i + 1} at turn ${turn} !!!`);
                console.error(`Action:`, JSON.stringify(action));
                console.error(err);
                process.exit(1);
            }
        }
    }

    console.log("Fuzz Test Passed! No crashes or invariant violations found.");
};

runFuzzTest();
