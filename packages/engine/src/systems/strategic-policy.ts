export type StrategicIntent = 'offense' | 'defense' | 'positioning' | 'control';

export interface StrategicPolicyWeights {
    survival: number;
    lethality: number;
    position: number;
    objective: number;
    status: number;
    tempo: number;
    resource: number;
}

export interface StrategicPolicyIntentThresholds {
    defenseHpRatio: number;
    defensePressureHpRatio: number;
    defensePressureAdjacentHostiles: number;
    controlMinHostiles: number;
}

export interface StrategicPolicyProfile {
    version: string;
    weightsByIntent: Record<StrategicIntent, StrategicPolicyWeights>;
    thresholds: StrategicPolicyIntentThresholds;
}

const DEFAULT_PROFILE: StrategicPolicyProfile = {
    version: 'sp-v1-default',
    weightsByIntent: {
        offense: {
            survival: 2.1,
            lethality: 6.5,
            position: 2.4,
            objective: 0.5,
            status: 2.5,
            tempo: 1.6,
            resource: 1.0
        },
        defense: {
            survival: 4.8,
            lethality: 3.6,
            position: 3.0,
            objective: 0.8,
            status: 2.2,
            tempo: 1.6,
            resource: 1.0
        },
        positioning: {
            survival: 2.3,
            lethality: 3.8,
            position: 3.1,
            objective: 6.0,
            status: 1.4,
            tempo: 1.6,
            resource: 1.0
        },
        control: {
            survival: 2.3,
            lethality: 4.2,
            position: 2.8,
            objective: 0.6,
            status: 3.4,
            tempo: 1.6,
            resource: 1.0
        }
    },
    thresholds: {
        defenseHpRatio: 0.45,
        defensePressureHpRatio: 0.65,
        defensePressureAdjacentHostiles: 2,
        controlMinHostiles: 3
    }
};

const AGGRO_PROFILE: StrategicPolicyProfile = {
    ...DEFAULT_PROFILE,
    version: 'sp-v1-aggro',
    weightsByIntent: {
        ...DEFAULT_PROFILE.weightsByIntent,
        offense: {
            ...DEFAULT_PROFILE.weightsByIntent.offense,
            survival: 1.8,
            lethality: 7.2,
            objective: 0.4
        },
        control: {
            ...DEFAULT_PROFILE.weightsByIntent.control,
            lethality: 4.8,
            status: 3.0
        }
    },
    thresholds: {
        ...DEFAULT_PROFILE.thresholds,
        defenseHpRatio: 0.38,
        defensePressureHpRatio: 0.58
    }
};

export const STRATEGIC_POLICY_PROFILES: Record<string, StrategicPolicyProfile> = {
    [DEFAULT_PROFILE.version]: DEFAULT_PROFILE,
    [AGGRO_PROFILE.version]: AGGRO_PROFILE
};

export const getStrategicPolicyProfile = (version?: string): StrategicPolicyProfile => {
    if (!version) return DEFAULT_PROFILE;
    return STRATEGIC_POLICY_PROFILES[version] || DEFAULT_PROFILE;
};
