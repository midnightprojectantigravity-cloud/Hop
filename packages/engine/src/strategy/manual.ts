import type { IStrategyProvider, Intent } from '../types/intent';
import type { GameState, Actor } from '../types';

export class ManualStrategy implements IStrategyProvider {
    private inputQueue: Intent[] = [];
    private resolveInput?: (intent: Intent) => void;

    /**
     * Called by the UI or Test Runner to push a player decision.
     */
    pushIntent(intent: Intent) {
        // ALWAYS buffer the intent, because the Game Loop (processNextTurn)
        // might have abandoned the previous Promise (it returns state instead of awaiting).
        this.inputQueue.push(intent);

        if (this.resolveInput) {
            this.resolveInput(intent);
            this.resolveInput = undefined;
        }
    }

    getIntent(_gameState: GameState, _actor: Actor): Promise<Intent> | Intent {
        if (this.inputQueue.length > 0) {
            return this.inputQueue.shift()!;
        }

        // If no input ready, return a Promise that waits for pushIntent
        return new Promise<Intent>((resolve) => {
            this.resolveInput = resolve;
        });
    }
}
