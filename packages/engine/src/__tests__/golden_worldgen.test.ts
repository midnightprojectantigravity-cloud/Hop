import { describe, expect, it } from 'vitest';
import {
    compileStandaloneFloor,
    createGenerationState,
} from '../generation';
import { GOLDEN_WORLDGEN_FIXTURES } from './golden-worldgen/fixtures';

describe('golden worldgen fixtures', () => {
    it.each(GOLDEN_WORLDGEN_FIXTURES)('$id remains deterministic', (fixture) => {
        const result = compileStandaloneFloor(fixture.floor, fixture.floorSeed, {
            generationState: createGenerationState(fixture.runSeed)
        });

        expect(result.verificationReport.code).toBe('OK');
        expect(result.artifact.artifactDigest).toBe(fixture.artifactDigest);
        expect(result.artifact.verificationDigest).toBe(fixture.verificationDigest);
        expect(result.generationState.currentFloorSummary?.sceneSignature.sceneId).toBe(fixture.sceneId);
        expect(result.generationState.currentFloorSummary?.moduleIds).toEqual(fixture.moduleIds);
        expect(result.generationState.directorEntropyKey).toBe(fixture.directorEntropyKey);
        expect(result.generationState.recentOutcomeQueue).toEqual(fixture.recentOutcomeQueue);
        expect(result.generationState.currentFloorSummary?.pathSummary).toEqual(fixture.pathSummary);
    });
});
