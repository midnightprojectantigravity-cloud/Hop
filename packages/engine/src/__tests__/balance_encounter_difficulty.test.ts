import { describe, expect, it } from 'vitest';
import type { CurrentFloorSummary, CompiledFloorArtifact } from '../generation/schema';
import { computeAllEnemyPowerProfiles } from '../systems/evaluation/balance-enemy-power';
import { computeEncounterDifficultyProfile, sampleEncounterDifficultyProfiles } from '../systems/evaluation/balance-encounter-difficulty';

const makeSummary = (): CurrentFloorSummary => ({
    floor: 3,
    role: 'pressure_spike',
    theme: 'inferno',
    parTurnTarget: 5,
    moduleIds: [],
    sceneSignature: {
        sceneId: 'encounter_3',
        motif: 'ash',
        mood: 'pressure',
        encounterPosture: 'aggressive',
        primaryEvidence: 'embers',
        hostileRosterDescriptor: 'mixed',
        terrainDescriptor: 'choke',
        spatialDescriptor: 'fork'
    },
    pathSummary: {
        mainLandmarkIds: ['entry', 'split', 'exit'],
        primaryLandmarkIds: ['entry', 'split', 'exit'],
        alternateLandmarkIds: ['split', 'flank', 'exit'],
        hiddenLandmarkIds: [],
        routeCount: 2,
        junctionCount: 2,
        maxStraightRun: 4,
        obstacleClusterCount: 2,
        trapClusterCount: 1,
        tacticalTileCount: 18,
        visualTileCount: 24
    },
    verificationDigest: 'v',
    artifactDigest: 'a'
});

const makeArtifact = (subtypes: string[]): Pick<CompiledFloorArtifact, 'enemySpawns'> => ({
    enemySpawns: subtypes.map((subtype, index) => ({
        id: `${subtype}_${index}`,
        subtype,
        position: { q: index, r: 0, s: -index }
    }))
});

describe('balance encounter difficulty', () => {
    it('raises encounter difficulty when a sentinel is added', () => {
        const enemyProfiles = Object.fromEntries(
            computeAllEnemyPowerProfiles().map(profile => [profile.subtype, profile])
        );
        const lighter = computeEncounterDifficultyProfile(makeSummary(), makeArtifact(['footman', 'archer']), enemyProfiles);
        const heavier = computeEncounterDifficultyProfile(makeSummary(), makeArtifact(['footman', 'sentinel']), enemyProfiles);

        expect(heavier.intrinsicDifficultyScore).toBeGreaterThan(lighter.intrinsicDifficultyScore);
    });

    it('samples deterministic compiled encounters', () => {
        const profiles = sampleEncounterDifficultyProfiles({ runSeed: 'balance-encounter-test', maxFloor: 2 });
        expect(profiles).toHaveLength(2);
    });
});
