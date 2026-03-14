import { describe, expect, it } from 'vitest';
import {
    compileStandaloneFloor,
    createCompilerSession,
    createGenerationState,
} from '../generation';

describe('world compiler session parity', () => {
    it('matches the sync compiler artifact when stepped pass-by-pass', () => {
        const runSeed = 'session-parity-seed';
        const floorSeed = `${runSeed}:5`;
        const generationState = createGenerationState(runSeed);
        const sync = compileStandaloneFloor(5, floorSeed, {
            generationState
        });

        const session = createCompilerSession({
            floor: 5,
            seed: floorSeed,
            options: {
                generationState
            }
        });

        while (!session.isComplete()) {
            session.step(1);
        }

        const stepped = session.getResult();
        expect(stepped).toBeDefined();
        expect(stepped?.artifact.artifactDigest).toBe(sync.artifact.artifactDigest);
        expect(stepped?.artifact.verificationDigest).toBe(sync.artifact.verificationDigest);
        expect(stepped?.artifact.modulePlacements).toEqual(sync.artifact.modulePlacements);
        expect(stepped?.generationState.currentFloorSummary).toEqual(sync.generationState.currentFloorSummary);
    });
});
