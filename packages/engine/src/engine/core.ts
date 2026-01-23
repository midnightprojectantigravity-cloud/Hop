import type { GameState, Action } from '../types';
import { gameReducer } from '../logic';
import { isPlayerTurn, startActorTurn } from '../systems/initiative';

/**
 * Headless Engine Entry Point
 * 
 * applyAction is the single source of truth for all game world transitions.
 * It is designed to be deterministic and isomorphic (runs in Vitest or React).
 * 
 * This fulfills the "Strategic Pivot" to a Headless Engine model.
 */
export const applyAction = (state: GameState, action: Action): { newState: GameState } => {
    let curState = state;

    // 1. Identity Phase (Spatial Memory)
    // If we are performing a player action, ensure the player's turn start state is captured 
    // in the initiative entries. This allows persistent passives like Auto-Attack (Punch)
    // to verify adjacency at BOTH the start and end of a turn.
    const playerActions: Action['type'][] = ['MOVE', 'THROW_SPEAR', 'WAIT', 'USE_SKILL', 'JUMP', 'SHIELD_BASH', 'ATTACK', 'LEAP'];

    if (playerActions.includes(action.type) && isPlayerTurn(curState)) {
        const queue = curState.initiativeQueue;
        const playerEntry = queue?.entries.find(e => e.actorId === curState.player.id);

        // If turn start hasn't been captured yet (first action of the turn), capture it now.
        if (playerEntry && !playerEntry.turnStartPosition) {
            curState = {
                ...curState,
                initiativeQueue: startActorTurn(curState, curState.player)
            };
        }
    }

    // 2. Core Execution
    // Delegation to the game rules engine (the gameReducer).
    const nextState = gameReducer(curState, action);

    // 3. Return wrapped for potential metadata (deltas, events, etc.)
    return {
        newState: nextState
    };
};
