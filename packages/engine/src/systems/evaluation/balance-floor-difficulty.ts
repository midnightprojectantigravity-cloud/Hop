import { compileStandaloneFloor, createGenerationState, type CurrentFloorSummary, type GenerationSpecInput } from '../../generation';
import type { FloorDifficultyProfile } from './balance-schema';

const round2 = (value: number): number => Number(value.toFixed(2));

const resolveBand = (score: number): FloorDifficultyProfile['difficultyBand'] => {
    if (score < 4) return 'trivial';
    if (score < 8) return 'low';
    if (score < 13) return 'medium';
    if (score < 18) return 'high';
    return 'spike';
};

const rolePressureModifier = (role: CurrentFloorSummary['role']): number => {
    switch (role) {
        case 'onboarding':
            return -1.5;
        case 'recovery':
            return -0.5;
        case 'pressure_spike':
            return 1.5;
        case 'elite':
            return 2.5;
        case 'boss':
            return 3.5;
        default:
            return 0;
    }
};

export const computeFloorDifficultyProfile = (
    summary: CurrentFloorSummary
): FloorDifficultyProfile => {
    const { pathSummary } = summary;
    const routeComplexityScore = round2(
        (Math.max(0, pathSummary.routeCount - 1) * 2.5)
        + (pathSummary.junctionCount * 1.5)
        + (Math.max(0, 6 - pathSummary.maxStraightRun) * 0.6)
    );
    const pathFrictionScore = round2(
        (pathSummary.obstacleClusterCount * 2.4)
        + (Math.max(0, pathSummary.routeCount - 1) * 0.75)
        + (Math.max(0, 5 - pathSummary.maxStraightRun) * 0.35)
    );
    const hazardPressureScore = round2(
        (pathSummary.trapClusterCount * 3)
        + (pathSummary.obstacleClusterCount * 0.8)
        + rolePressureModifier(summary.role)
    );
    const recoveryAccessScore = round2(Math.max(
        0,
        (summary.role === 'recovery' ? 4 : summary.role === 'onboarding' ? 2.5 : 1)
        + (pathSummary.routeCount >= 2 ? 1.5 : 0)
        - (pathSummary.trapClusterCount * 0.35)
        - (pathSummary.obstacleClusterCount * 0.2)
    ));
    const navigationDifficultyScore = round2(
        (routeComplexityScore * 0.7)
        + (pathFrictionScore * 0.55)
        + (Math.max(0, pathSummary.maxStraightRun - 4) * 0.4)
    );
    const intrinsicDifficultyScore = round2(Math.max(
        0,
        navigationDifficultyScore
        + hazardPressureScore
        - (recoveryAccessScore * 0.5)
        + rolePressureModifier(summary.role)
    ));

    const rationale = [
        `routes ${pathSummary.routeCount}`,
        `junctions ${pathSummary.junctionCount}`,
        `straight run ${pathSummary.maxStraightRun}`,
        `obstacles ${pathSummary.obstacleClusterCount}`,
        `traps ${pathSummary.trapClusterCount}`
    ];

    return {
        floor: summary.floor,
        role: summary.role,
        theme: summary.theme,
        routeCount: pathSummary.routeCount,
        junctionCount: pathSummary.junctionCount,
        maxStraightRun: pathSummary.maxStraightRun,
        obstacleClusterCount: pathSummary.obstacleClusterCount,
        trapClusterCount: pathSummary.trapClusterCount,
        routeComplexityScore,
        pathFrictionScore,
        hazardPressureScore,
        recoveryAccessScore,
        navigationDifficultyScore,
        intrinsicDifficultyScore,
        difficultyBand: resolveBand(intrinsicDifficultyScore),
        rationale
    };
};

export interface FloorDifficultySampleOptions {
    runSeed?: string;
    maxFloor?: number;
    generationSpec?: GenerationSpecInput;
}

export const sampleFloorDifficultyProfiles = (
    options: FloorDifficultySampleOptions = {}
): FloorDifficultyProfile[] => {
    const runSeed = options.runSeed || 'balance-stack';
    const maxFloor = Math.max(1, options.maxFloor || 6);
    let generationState = createGenerationState(runSeed, options.generationSpec);
    const profiles: FloorDifficultyProfile[] = [];

    for (let floor = 1; floor <= maxFloor; floor++) {
        const result = compileStandaloneFloor(floor, `${runSeed}-floor-${floor}`, {
            generationState,
            generationSpec: options.generationSpec
        });
        generationState = result.generationState;
        const summary = generationState.currentFloorSummary;
        if (!summary) {
            throw new Error(`Missing currentFloorSummary after compiling floor ${floor}`);
        }
        profiles.push(computeFloorDifficultyProfile(summary));
    }

    return profiles;
};
