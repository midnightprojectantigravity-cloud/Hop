import type { IStrategyProvider, Intent } from '../types/intent';
import type { GameState, Actor } from '../types';

export class GhostStrategy implements IStrategyProvider {
    private replayData: Map<number, Intent>;

    constructor(recordedIntents: Intent[]) {
        this.replayData = new Map();
        recordedIntents.forEach(intent => {
            // Assuming we track which turn/priority an intent belongs to
            // For now, let's map by some key or just behave as a queue if per-turn
            // The simplest is probably a Queue, but we need to know *when* to release.
            // Let's assume the TurnManager asks for intent for a specific Actor at a specific time.
            // But strict turn mapping is safer.
            // Let's assume we map by GameState.rngCounter or TurnNumber?
            // Actually, for a Ghost Replay, we want to replicate the EXACT sequence.
            // But StrategyProvider is called *per actor*.
        });
        // Simplification: We will shift from a queue in order.
        // BEWARE: If the simulation diverges, the queue might get out of sync.
        // But the "Agency Swap" test enforces no divergence.
    }

    // Alternative: The recording might be an ActionLog.
    // If it's an ActionLog, we need to convert Action -> Intent.
    // Let's stick to the Plan: "Reads from a recorded buffer of previous moves."
    // I'll make it a simple Queue for now.

    private intentQueue: Intent[] = [];

    setRecording(intents: Intent[]) {
        this.intentQueue = [...intents];
    }

    getIntent(gameState: GameState, actor: Actor): Intent {
        const nextIntent = this.intentQueue.shift();

        if (!nextIntent) {
            // Run out of moves? Default to Wait.
            return {
                type: 'WAIT',
                actorId: actor.id,
                skillId: 'WAIT_SKILL',
                priority: 0,
                metadata: {
                    expectedValue: 0,
                    reasoningCode: 'GHOST_FINISHED',
                    isGhost: true
                }
            };
        }

        // Ensure the intent matches the actor?
        if (nextIntent.actorId !== actor.id) {
            console.warn(`GhostStrategy Desync: Expected actor ${nextIntent.actorId}, got request for ${actor.id}`);
            // We might want to peek instead of shift if we have multiple ghosts sharing a strategy?
            // Usually each Actor has their own Strategy instance.
        }

        return {
            ...nextIntent,
            metadata: {
                ...nextIntent.metadata,
                isGhost: true
            }
        };
    }
}
