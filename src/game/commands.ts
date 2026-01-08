/**
 * COMMAND PATTERN & STATE DELTAS
 * Enables infinite undo and deterministic replays.
 * Handles recording and undo functionality.
 * TODO: Implement "Compressed JSON Patches" for StateDelta to reduce memory footprint.
 */
import type { GameState, Action, Command, StateDelta } from './types';

/**
 * Create a new command from an action.
 */
export const createCommand = (action: Action): Command => {
    return {
        id: Math.random().toString(36).slice(2, 9),
        timestamp: Date.now(),
        action,
    };
};

/**
 * Simple State Diffing / Snapshotting for Undo (Goal 2)
 * In a production app, this would use JSON patches or similar.
 * For our "Lite" version, we store enough data to revert the specific change.
 */
export const createDelta = (oldState: GameState, _newState: GameState): StateDelta => {
    // For Infinite Undo, we can store the whole old state in undoData 
    // OR we can implement specific field-level diffs.
    // Given the "Lite" requirement, we'll store a shallow copy of affected entities.
    return {
        id: Math.random().toString(36).slice(2, 9),
        undoData: {
            player: { ...oldState.player },
            enemies: [...oldState.enemies],
            // ... add other fields as needed
            turn: oldState.turn,
            gameStatus: oldState.gameStatus,
        }
    };
};

/**
 * Revert a state delta to perform an Undo.
 */
export const revertDelta = (state: GameState, delta: StateDelta): GameState => {
    return {
        ...state,
        ...delta.undoData,
        // We MUST preserve things that shouldn't be undone like the RNG seed (maybe?)
        // but undo usually reverts everything back to the exact previous frame.
    };
};
