import type { GameState } from '../../../types';
import {
    normalizeGenericAiGoal,
    type GenericAiGoal,
    type GenericAiGoalProfile
} from '../generic-goal';

export {
    getGenericAiGoalProfile,
    normalizeGenericAiGoal,
    type GenericAiGoal,
    type GenericAiGoalProfile
} from '../generic-goal';

export const chooseGenericAiGoal = (
    state: GameState,
    profile: GenericAiGoalProfile
): GenericAiGoal => normalizeGenericAiGoal(state.player.behaviorState?.goal || profile.defaultGoal);
