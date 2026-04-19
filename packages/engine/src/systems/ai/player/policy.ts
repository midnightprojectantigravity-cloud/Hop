import type { GameState } from '../../../types';
import {
    normalizeGenericAiGoal,
    type GenericAiGoal,
    type GenericAiGoalProfile
} from '../generic-goal';
import { recomputeVisibility } from '../../visibility';

export {
    getGenericAiGoalProfile,
    normalizeGenericAiGoal,
    type GenericAiGoal,
    type GenericAiGoalProfile
} from '../generic-goal';

const getAliveHostileCount = (state: GameState): number =>
    state.enemies.filter(enemy =>
        enemy.hp > 0
        && enemy.factionId === 'enemy'
        && enemy.subtype !== 'bomb'
    ).length;

const POST_COMBAT_RECOVERY_ARCHETYPES = new Set(['FIREMAGE', 'NECROMANCER']);

export const chooseGenericAiGoal = (
    state: GameState,
    profile: GenericAiGoalProfile
): GenericAiGoal => {
    const visibleState = recomputeVisibility(state);
    const explicitGoal = state.player.behaviorState?.goal;
    if (explicitGoal) return normalizeGenericAiGoal(explicitGoal);

    const aliveHostiles = getAliveHostileCount(visibleState);
    if (aliveHostiles > 0) {
        const hpRatio = Number(visibleState.player.hp || 0) / Math.max(1, Number(visibleState.player.maxHp || 1));
        if (visibleState.player.ires?.currentState === 'exhausted' || hpRatio < 0.3) {
            return 'recover';
        }
        return 'engage';
    }

    if (
        visibleState.player.hp < visibleState.player.maxHp
        && !POST_COMBAT_RECOVERY_ARCHETYPES.has(visibleState.player.archetype || '')
    ) {
        return 'recover';
    }

    if (POST_COMBAT_RECOVERY_ARCHETYPES.has(visibleState.player.archetype || '')) {
        return 'engage';
    }

    if (visibleState.shrinePosition) {
        const hpRatio = Number(visibleState.player.hp || 0) / Math.max(1, Number(visibleState.player.maxHp || 1));
        if (hpRatio < 0.6) {
            return 'recover';
        }
    }

    return normalizeGenericAiGoal(profile.defaultGoal);
};
