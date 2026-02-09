export interface EntityCalibrationSurface {
    hpSurvivabilityCoeff: number;
    armorSurvivabilityCoeff: number;
    speedMobilityCoeff: number;
    speedEconomyCoeff: number;
    skillPowerCoeff: number;
    skillControlCoeff: number;
    skillMobilityCoeff: number;
}

export interface SkillCalibrationSurface {
    staticWeight: number;
    powerCoeff: number;
    reachCoeff: number;
    safetyCoeff: number;
    tempoCoeff: number;
    complexityCoeff: number;
    perSkillScalar: Record<string, number>;
}

export interface PolicyCalibrationSurface {
    offenseWeight: number;
    defenseWeight: number;
    positioningWeight: number;
    statusWeight: number;
    riskPenaltyWeight: number;
}

export interface EncounterCalibrationSurface {
    hazardWeight: number;
    spawnPressureWeight: number;
    objectiveWeight: number;
    pathFrictionWeight: number;
    lowBandMax: number;
    mediumBandMax: number;
}

export interface CalibrationProfile {
    version: string;
    entity: EntityCalibrationSurface;
    skill: SkillCalibrationSurface;
    policy: PolicyCalibrationSurface;
    encounter: EncounterCalibrationSurface;
}

export const DEFAULT_CALIBRATION_PROFILE: CalibrationProfile = {
    version: 'cal-v1',
    entity: {
        hpSurvivabilityCoeff: 4,
        armorSurvivabilityCoeff: 4,
        speedMobilityCoeff: 0.8,
        speedEconomyCoeff: 0.4,
        skillPowerCoeff: 1,
        skillControlCoeff: 1,
        skillMobilityCoeff: 1,
    },
    skill: {
        staticWeight: 0.5,
        powerCoeff: 1,
        reachCoeff: 1,
        safetyCoeff: 1,
        tempoCoeff: 1,
        complexityCoeff: 1,
        perSkillScalar: {}
    },
    policy: {
        offenseWeight: 1,
        defenseWeight: 1,
        positioningWeight: 1,
        statusWeight: 1,
        riskPenaltyWeight: 1
    },
    encounter: {
        hazardWeight: 1,
        spawnPressureWeight: 1,
        objectiveWeight: 1,
        pathFrictionWeight: 1,
        lowBandMax: 30,
        mediumBandMax: 60
    }
};

export const FIREMAGE_BASELINE_PROFILE: CalibrationProfile = {
    ...DEFAULT_CALIBRATION_PROFILE,
    version: 'cal-v1-firemage-baseline',
    policy: {
        ...DEFAULT_CALIBRATION_PROFILE.policy,
        offenseWeight: 1.1,
        positioningWeight: 1.05
    },
    skill: {
        ...DEFAULT_CALIBRATION_PROFILE.skill,
        perSkillScalar: {
            FIREBALL: 1.05,
            FIREWALL: 1.05,
            FIREWALK: 1.02
        }
    }
};

export const CALIBRATION_PRESETS: Record<string, CalibrationProfile> = {
    [DEFAULT_CALIBRATION_PROFILE.version]: DEFAULT_CALIBRATION_PROFILE,
    [FIREMAGE_BASELINE_PROFILE.version]: FIREMAGE_BASELINE_PROFILE
};

export const getCalibrationProfile = (version?: string): CalibrationProfile => {
    if (!version) return DEFAULT_CALIBRATION_PROFILE;
    return CALIBRATION_PRESETS[version] || DEFAULT_CALIBRATION_PROFILE;
};

