import { describe, expect, it } from 'vitest';
import type { CurrentFloorSummary } from '../generation/schema';
import { computeFloorDifficultyProfile, sampleFloorDifficultyProfiles } from '../systems/evaluation/balance-floor-difficulty';

const makeSummary = (overrides?: Partial<CurrentFloorSummary>): CurrentFloorSummary => ({
    floor: 2,
    role: 'pressure_spike',
    theme: 'inferno',
    parTurnTarget: 5,
    moduleIds: ['inferno_split_fork'],
    sceneSignature: {
        sceneId: 'pressure_2',
        motif: 'cinders',
        mood: 'tight',
        encounterPosture: 'aggressive',
        primaryEvidence: 'ash',
        hostileRosterDescriptor: 'mixed',
        terrainDescriptor: 'choke',
        spatialDescriptor: 'split'
    },
    pathSummary: {
        mainLandmarkIds: ['entry', 'split', 'merge', 'exit'],
        primaryLandmarkIds: ['entry', 'split', 'merge', 'exit'],
        alternateLandmarkIds: ['split', 'flank', 'merge'],
        hiddenLandmarkIds: [],
        routeCount: 2,
        junctionCount: 2,
        maxStraightRun: 4,
        obstacleClusterCount: 2,
        trapClusterCount: 1,
        tacticalTileCount: 18,
        visualTileCount: 28
    },
    verificationDigest: 'verify',
    artifactDigest: 'artifact',
    ...overrides
});

describe('balance floor difficulty', () => {
    it('raises hazard pressure when trap pressure rises', () => {
        const base = computeFloorDifficultyProfile(makeSummary());
        const hotter = computeFloorDifficultyProfile(makeSummary({
            pathSummary: {
                ...makeSummary().pathSummary,
                trapClusterCount: 3
            }
        }));

        expect(hotter.hazardPressureScore).toBeGreaterThan(base.hazardPressureScore);
        expect(hotter.intrinsicDifficultyScore).toBeGreaterThan(base.intrinsicDifficultyScore);
    });

    it('samples deterministic real floor profiles', () => {
        const profiles = sampleFloorDifficultyProfiles({ runSeed: 'balance-floor-test', maxFloor: 3 });

        expect(profiles).toHaveLength(3);
        expect(profiles.every(profile => Number.isFinite(profile.intrinsicDifficultyScore))).toBe(true);
    });
});
