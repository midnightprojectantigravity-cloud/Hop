import type { IStrategyProvider, Intent } from '../types/intent';
import type { GameState, Actor } from '../types';
import { decideEnemyIntent } from '../systems/ai';
import { resolveEnemyTrackingTarget } from '../systems/visibility';

export class WildStrategy implements IStrategyProvider {
    getIntent(gameState: GameState, actor: Actor): Intent {
        const trackedTarget = resolveEnemyTrackingTarget(gameState, actor);
        return decideEnemyIntent(
            actor,
            trackedTarget,
            { ...gameState, occupiedCurrentTurn: gameState.occupiedCurrentTurn }
        );
    }
}
