import type { Intent } from '../types/intent';
import type { GameState, Actor } from '../types';
import { isStunned } from './status'; // Assuming this helper exists or I import from where it is

/**
 * Layer 2: The Intent Override (The "Interception").
 * Modifies the Raw Intent based on Game Rules and Status Effects.
 */
export const processIntent = (intent: Intent, _gameState: GameState, actor: Actor): Intent => {
    // 1. Check Status Effects
    if (isStunned(actor)) {
        return {
            ...intent,
            type: 'WAIT',
            skillId: 'WAIT_SKILL',
            priority: 0,
            metadata: {
                ...intent.metadata,
                reasoningCode: 'STATUS_STUNNED'
            }
        };
    }

    // TODO: Implement Confused (Random target?)
    // if (isConfused(actor)) { ... }

    // TODO: Implement Taunted (Force target to Taunter)
    // if (isTaunted(actor)) { ... }

    // 2. Check Player Overrides (if any)
    // In the future, we might check a "CommandQueue" for the player overriding a Companion.

    return intent;
};
