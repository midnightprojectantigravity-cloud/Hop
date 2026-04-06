import type { GenericAiGoal } from '../../types';

export type { GenericAiGoal } from '../../types';

export interface GenericAiGoalProfile {
    version: string;
    defaultGoal: GenericAiGoal;
}

const DEFAULT_GOAL_PROFILE: GenericAiGoalProfile = {
    version: 'sp-v1-default',
    defaultGoal: 'explore'
};

const AGGRO_GOAL_PROFILE: GenericAiGoalProfile = {
    version: 'sp-v1-aggro',
    defaultGoal: 'engage'
};

const BALANCE_GOAL_PROFILE: GenericAiGoalProfile = {
    version: 'sp-v1-balance',
    defaultGoal: 'explore'
};

export const GENERIC_AI_GOAL_PROFILES: Record<string, GenericAiGoalProfile> = {
    [DEFAULT_GOAL_PROFILE.version]: DEFAULT_GOAL_PROFILE,
    [AGGRO_GOAL_PROFILE.version]: AGGRO_GOAL_PROFILE,
    [BALANCE_GOAL_PROFILE.version]: BALANCE_GOAL_PROFILE
};

export const normalizeGenericAiGoal = (goal?: GenericAiGoal | null): GenericAiGoal => goal || 'engage';

export const getGenericAiGoalProfile = (version?: string): GenericAiGoalProfile => {
    if (!version) return BALANCE_GOAL_PROFILE;
    return GENERIC_AI_GOAL_PROFILES[version] || BALANCE_GOAL_PROFILE;
};
