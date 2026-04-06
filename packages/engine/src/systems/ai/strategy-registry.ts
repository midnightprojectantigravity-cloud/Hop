import type { IStrategyProvider } from '../../types/intent';
import type { Actor } from '../../types';
import { WildStrategy } from '../../strategy/wild';
import { ManualStrategy } from '../../strategy/manual';
import { GenericAiStrategy } from '../../strategy/generic-ai';

/**
 * Registry to resolve the correct Strategy Provider for an actor.
 * Keeps the GameState serializable by storing these instances outside of it.
 */
export class StrategyRegistry {
    private static strategies = new Map<string, IStrategyProvider>();
    private static defaultEnemyStrategy = new WildStrategy();
    private static defaultPlayerStrategy = new ManualStrategy();
    private static defaultGenericAiStrategy = new GenericAiStrategy();

    static register(actorId: string, strategy: IStrategyProvider) {
        this.strategies.set(actorId, strategy);
    }

    static resolve(actor: Actor): IStrategyProvider {
        if (this.strategies.has(actor.id)) {
            return this.strategies.get(actor.id)!;
        }

        if (actor.behaviorState?.controller === 'generic_ai') {
            return this.defaultGenericAiStrategy;
        }

        if (actor.behaviorState?.controller === 'manual') {
            return this.defaultPlayerStrategy;
        }

        if (actor.type === 'player') {
            return this.defaultPlayerStrategy;
        }

        return this.defaultEnemyStrategy;
    }

    static reset() {
        this.strategies.clear();
        // Re-instantiate defaults if they hold state (ManualStrategy does hold input queue)
        this.defaultEnemyStrategy = new WildStrategy();
        this.defaultPlayerStrategy = new ManualStrategy();
        this.defaultGenericAiStrategy = new GenericAiStrategy();
    }
}
