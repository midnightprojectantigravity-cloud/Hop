import { describe, expect, it } from 'vitest';
import { compileStandaloneFloor, createGenerationState } from '../generation';

describe('authored path overrides', () => {
    it('keeps boss authored anchors on the main route', () => {
        const result = compileStandaloneFloor(10, 'golden-boss-1:10', {
            generationState: createGenerationState('golden-boss-1')
        });
        const summary = result.generationState.currentFloorSummary?.pathSummary;

        expect(summary?.mainLandmarkIds).toContain('primary_slot');
        expect(summary?.mainLandmarkIds).toContain('secondary_slot');
        expect(summary?.hiddenLandmarkIds).not.toContain('secondary_slot');
    });

    it('keeps escape-family secondary anchors off the visual route', () => {
        const result = compileStandaloneFloor(8, 'golden-escape-a:8', {
            generationState: createGenerationState('golden-escape-a')
        });
        const summary = result.generationState.currentFloorSummary?.pathSummary;

        expect(summary?.mainLandmarkIds).toContain('primary_slot');
        expect(summary?.hiddenLandmarkIds).toContain('secondary_slot');
        expect(summary?.mainLandmarkIds).not.toContain('secondary_slot');
    });
});
