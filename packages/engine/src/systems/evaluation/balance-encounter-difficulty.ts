import { compileStandaloneFloor, createGenerationState, type CompiledFloorArtifact, type CurrentFloorSummary, type GenerationSpecInput } from '../../generation';
import type { EncounterDifficultyProfile, EnemyPowerProfile, FloorDifficultyProfile } from './balance-schema';
import { computeFloorDifficultyProfile } from './balance-floor-difficulty';
import { computeAllEnemyPowerProfiles } from './balance-enemy-power';

const round2 = (value: number): number => Number(value.toFixed(2));

const resolveBand = (score: number): EncounterDifficultyProfile['difficultyBand'] => {
    if (score < 8) return 'trivial';
    if (score < 14) return 'low';
    if (score < 22) return 'medium';
    if (score < 34) return 'high';
    return 'spike';
};

export const computeEncounterDifficultyProfile = (
    summary: CurrentFloorSummary,
    artifact: Pick<CompiledFloorArtifact, 'enemySpawns'>,
    enemyProfilesBySubtype: Record<string, EnemyPowerProfile>,
    floorProfile: FloorDifficultyProfile = computeFloorDifficultyProfile(summary)
): EncounterDifficultyProfile => {
    const enemySubtypeIds = artifact.enemySpawns.map(spawn => spawn.subtype).sort();
    const encounterEnemyPowerScore = round2(
        artifact.enemySpawns.reduce((sum, spawn) => sum + (enemyProfilesBySubtype[spawn.subtype]?.intrinsicPowerScore || 0), 0)
    );
    const spawnPressureScore = round2(
        artifact.enemySpawns.length * 1.25
        + artifact.enemySpawns.reduce((sum, spawn) => sum + (enemyProfilesBySubtype[spawn.subtype]?.budgetCost || 0), 0)
    );
    const routePressureScore = round2(
        (floorProfile.pathFrictionScore * 0.9)
        + (floorProfile.hazardPressureScore * 0.8)
        + (floorProfile.routeComplexityScore * 0.45)
    );
    const objectiveTensionScore = round2(
        Math.max(0, 8 - summary.parTurnTarget)
        + (summary.role === 'pressure_spike' ? 1.5 : 0)
        + (summary.role === 'elite' ? 2 : 0)
        + (summary.role === 'boss' ? 3 : 0)
    );
    const intrinsicDifficultyScore = round2(
        (floorProfile.intrinsicDifficultyScore * 0.9)
        + (encounterEnemyPowerScore * 0.16)
        + (spawnPressureScore * 0.35)
        + routePressureScore
        + objectiveTensionScore
    );

    return {
        floor: summary.floor,
        role: summary.role,
        theme: summary.theme,
        enemyCount: artifact.enemySpawns.length,
        uniqueEnemySubtypeCount: new Set(enemySubtypeIds).size,
        enemySubtypeIds,
        encounterEnemyPowerScore,
        spawnPressureScore,
        routePressureScore,
        objectiveTensionScore,
        intrinsicDifficultyScore,
        difficultyBand: resolveBand(intrinsicDifficultyScore),
        rationale: [
            `enemy power ${encounterEnemyPowerScore}`,
            `spawn pressure ${spawnPressureScore}`,
            `route pressure ${routePressureScore}`,
            `objective tension ${objectiveTensionScore}`
        ]
    };
};

export interface EncounterDifficultySampleOptions {
    runSeed?: string;
    maxFloor?: number;
    generationSpec?: GenerationSpecInput;
}

export const sampleEncounterDifficultyProfiles = (
    options: EncounterDifficultySampleOptions = {}
): EncounterDifficultyProfile[] => {
    const runSeed = options.runSeed || 'balance-stack';
    const maxFloor = Math.max(1, options.maxFloor || 6);
    let generationState = createGenerationState(runSeed, options.generationSpec);
    const enemyProfiles = Object.fromEntries(
        computeAllEnemyPowerProfiles().map(profile => [profile.subtype, profile])
    );
    const profiles: EncounterDifficultyProfile[] = [];

    for (let floor = 1; floor <= maxFloor; floor++) {
        const result = compileStandaloneFloor(floor, `${runSeed}-encounter-${floor}`, {
            generationState,
            generationSpec: options.generationSpec
        });
        generationState = result.generationState;
        const summary = generationState.currentFloorSummary;
        if (!summary) {
            throw new Error(`Missing currentFloorSummary after compiling encounter floor ${floor}`);
        }
        profiles.push(computeEncounterDifficultyProfile(summary, result.artifact, enemyProfiles));
    }

    return profiles;
};
