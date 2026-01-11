/**
 * INITIATIVE QUEUE SYSTEM
 * 
 * Implements granular per-actor turn management. Each actor takes their own turn
 * according to their initiative score. Higher initiative = acts earlier.
 * 
 * Key concepts:
 * - Initiative Score: Determines turn order (higher goes first)
 * - Turn Start Position: Captured at the start of each actor's individual turn
 * - Round: One complete cycle through all actors in the initiative queue
 * 
 * AUTO_ATTACK (Punch) behavior:
 * - Triggers at the END of an actor's individual turn
 * - Compares positions at START of that actor's turn vs END of that actor's turn
 * - Only hits targets that were adjacent at turn start AND are adjacent at turn end
 */

import type { Actor, Point, GameState, InitiativeEntry, InitiativeQueue } from './types';

/** Default initiative values by actor type */
export const DEFAULT_INITIATIVE = {
    player: 100,      // Player always goes first by default
    footman: 50,      // Standard melee enemy
    archer: 60,       // Ranged enemies act slightly earlier
    shieldBearer: 40, // Heavy enemies act slower
    bomber: 30,       // Bombers are slow
    warlock: 55,      // Casters are mid-speed
    bomb: 10,         // Bombs tick last
} as const;

/**
 * Calculate initiative score for an actor.
 * Can be modified by status effects, equipment, etc.
 */
export const getInitiativeScore = (actor: Actor): number => {
    // Base initiative from actor speed or default subtype
    let initiative = actor.speed;

    if (initiative === undefined) {
        const subtype = actor.subtype as keyof typeof DEFAULT_INITIATIVE;
        initiative = actor.type === 'player'
            ? DEFAULT_INITIATIVE.player
            : (DEFAULT_INITIATIVE[subtype] ?? 50);
    }

    // Status effect modifiers
    const isStunned = actor.statusEffects?.some(s => s.type === 'stunned');
    if (isStunned) {
        initiative -= 100; // Stunned actors act last (or not at all)
    }

    // Could add: speed boosts, slow debuffs, equipment bonuses, etc.

    return initiative;
};

/**
 * Build a fresh initiative queue from all actors in the game.
 * Called at the start of each round.
 */
export const buildInitiativeQueue = (state: GameState): InitiativeQueue => {
    const entries: InitiativeEntry[] = [];

    // Add player
    entries.push({
        actorId: state.player.id,
        initiative: getInitiativeScore(state.player),
        hasActed: false,
        turnStartPosition: undefined, // Will be set when their turn starts
    });

    // Add all enemies
    for (const enemy of state.enemies) {
        entries.push({
            actorId: enemy.id,
            initiative: getInitiativeScore(enemy),
            hasActed: false,
            turnStartPosition: undefined,
        });
    }

    // Sort by initiative (descending - higher goes first)
    entries.sort((a, b) => b.initiative - a.initiative);

    // console.log(`DEBUG: Built queue with ${entries.length} entries: ${entries.map(e => e.actorId).join(', ')}`);
    return {
        entries,
        currentIndex: -1, // Not started yet
        round: 1,
    };
};

/**
 * Get the actor whose turn it currently is.
 */
export const getCurrentActor = (state: GameState): Actor | null => {
    const queue = state.initiativeQueue;
    if (!queue || queue.currentIndex < 0 || queue.currentIndex >= queue.entries.length) {
        return null;
    }

    const entry = queue.entries[queue.currentIndex];
    if (entry.actorId === state.player.id) {
        return state.player;
    }

    return state.enemies.find(e => e.id === entry.actorId) ?? null;
};

/**
 * Get the current initiative entry.
 */
export const getCurrentEntry = (queue: InitiativeQueue): InitiativeEntry | null => {
    if (queue.currentIndex < 0 || queue.currentIndex >= queue.entries.length) {
        return null;
    }
    return queue.entries[queue.currentIndex];
};

/**
 * Start the next actor's turn. Returns updated queue and the actor ID.
 * If all actors have acted, starts a new round.
 */
export const advanceInitiative = (state: GameState): {
    queue: InitiativeQueue;
    actorId: string | null;
    newRound: boolean;
} => {
    let queue = state.initiativeQueue;

    // If no queue exists, build one
    if (!queue) {
        queue = buildInitiativeQueue(state);
    }

    // Find the next actor who hasn't acted
    let nextIndex = queue.currentIndex + 1;
    while (nextIndex < queue.entries.length && queue.entries[nextIndex].hasActed) {
        nextIndex++;
    }

    // If all actors have acted, start a new round
    if (nextIndex >= queue.entries.length) {
        queue = buildInitiativeQueue(state);
        queue.round = (state.initiativeQueue?.round ?? 0) + 1;
        nextIndex = 0;

        return {
            queue: { ...queue, currentIndex: nextIndex },
            actorId: queue.entries[nextIndex]?.actorId ?? null,
            newRound: true,
        };
    }

    // console.log(`DEBUG: Advance returning ${queue.entries[nextIndex]?.actorId} (index ${nextIndex})`);
    return {
        queue: { ...queue, currentIndex: nextIndex },
        actorId: queue.entries[nextIndex]?.actorId ?? null,
        newRound: false,
    };
};

/**
 * Mark the current actor's turn as started. Captures their position.
 */
export const startActorTurn = (state: GameState, actor: Actor): InitiativeQueue => {
    const queue = state.initiativeQueue;
    if (!queue) return buildInitiativeQueue(state);

    const updatedEntries = queue.entries.map(entry => {
        if (entry.actorId === actor.id) {
            return {
                ...entry,
                turnStartPosition: { ...actor.position },
            };
        }
        return entry;
    });

    return {
        ...queue,
        entries: updatedEntries,
    };
};

/**
 * Mark the current actor's turn as ended.
 */
export const endActorTurn = (state: GameState, actorId: string): InitiativeQueue => {
    const queue = state.initiativeQueue;
    if (!queue) return buildInitiativeQueue(state);

    const updatedEntries = queue.entries.map(entry => {
        if (entry.actorId === actorId) {
            return {
                ...entry,
                hasActed: true,
            };
        }
        return entry;
    });

    return {
        ...queue,
        entries: updatedEntries,
    };
};

/**
 * Get the position an actor was at when their current turn started.
 * Used for AUTO_ATTACK persistence checks.
 */
export const getTurnStartPosition = (state: GameState, actorId: string): Point | null => {
    const queue = state.initiativeQueue;
    if (!queue) return null;

    const entry = queue.entries.find(e => e.actorId === actorId);
    return entry?.turnStartPosition ?? null;
};

/**
 * Check if it's currently a specific actor's turn.
 */
export const isActorTurn = (state: GameState, actorId: string): boolean => {
    const currentActor = getCurrentActor(state);
    return currentActor?.id === actorId;
};

/**
 * Check if it's the player's turn.
 */
export const isPlayerTurn = (state: GameState): boolean => {
    return isActorTurn(state, state.player.id);
};

/**
 * Remove a dead actor from the initiative queue.
 */
export const removeFromQueue = (queue: InitiativeQueue, actorId: string): InitiativeQueue => {
    const newEntries = queue.entries.filter(e => e.actorId !== actorId);

    // Adjust currentIndex if needed
    let newIndex = queue.currentIndex;
    const removedIndex = queue.entries.findIndex(e => e.actorId === actorId);
    if (removedIndex >= 0 && removedIndex < queue.currentIndex) {
        newIndex--;
    }

    return {
        ...queue,
        entries: newEntries,
        currentIndex: Math.min(newIndex, newEntries.length - 1),
    };
};

/**
 * Add a new actor to the initiative queue (e.g., spawned enemy).
 * They act at the end of the current round.
 */
export const addToQueue = (queue: InitiativeQueue, actor: Actor): InitiativeQueue => {
    const newEntry: InitiativeEntry = {
        actorId: actor.id,
        initiative: getInitiativeScore(actor),
        hasActed: true, // They don't act this round
        turnStartPosition: undefined,
    };

    return {
        ...queue,
        entries: [...queue.entries, newEntry],
    };
};

/**
 * Debug: Get a formatted string of the current initiative order.
 */
export const formatInitiativeQueue = (state: GameState): string => {
    const queue = state.initiativeQueue;
    if (!queue) return 'No initiative queue';

    const lines = queue.entries.map((entry, index) => {
        const actor = entry.actorId === state.player.id
            ? state.player
            : state.enemies.find(e => e.id === entry.actorId);

        const name = actor?.type === 'player' ? 'Player' : (actor?.subtype ?? 'Unknown');
        const marker = index === queue.currentIndex ? '→ ' : '  ';
        const acted = entry.hasActed ? ' ✓' : '';

        return `${marker}${name} (${entry.initiative})${acted}`;
    });

    return `Round ${queue.round}:\n${lines.join('\n')}`;
};
