import type { GameState, AtomicEffect } from '../types';

/**
 * VITALS SYSTEM
 * Responsible for monitoring life/death states of entities.
 * Goal: Emit GameOver if player dies.
 */

export const checkVitals = (state: GameState): AtomicEffect[] => {
    const effects: AtomicEffect[] = [];

    // Check Player Death
    if (state.player.hp <= 0) {
        effects.push({ type: 'GameOver', reason: 'PLAYER_DIED' });
        effects.push({ type: 'Message', text: 'FATAL: Vital signs lost. Simulation terminated.' });
    }

    return effects;
};
