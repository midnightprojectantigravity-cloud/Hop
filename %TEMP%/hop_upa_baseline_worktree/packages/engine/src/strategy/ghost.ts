import type { IStrategyProvider, Intent } from '../types/intent';
import type { GameState, Actor } from '../types';

export class GhostStrategy implements IStrategyProvider {
    private intentQueue: Intent[] = [];

    constructor(recordedIntents: Intent[]) {
        this.intentQueue = [...recordedIntents];
    }

    setRecording(intents: Intent[]) {
        this.intentQueue = [...intents];
    }

    getIntent(gameState: GameState, actor: Actor): Intent {
        // Consume intents until we find one for the requested actor.
        // If we dropped stale intents here, replay drift has already occurred upstream.
        let nextIntent = this.intentQueue.shift();
        while (nextIntent && nextIntent.actorId !== actor.id) {
            console.warn(`GhostStrategy Desync: Dropping intent for ${nextIntent.actorId}, requested ${actor.id}`);
            nextIntent = this.intentQueue.shift();
        }

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

        return {
            ...nextIntent,
            metadata: {
                ...nextIntent.metadata,
                isGhost: true
            }
        };
    }
}
