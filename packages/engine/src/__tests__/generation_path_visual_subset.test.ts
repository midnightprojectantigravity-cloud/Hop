import { describe, expect, it } from 'vitest';
import { pointToKey } from '../hex';
import { compileStandaloneFloor, createGenerationState } from '../generation';

const buildEdgeKey = (fromKey: string, toKey: string): string =>
    fromKey < toKey ? `${fromKey}|${toKey}` : `${toKey}|${fromKey}`;

describe('visual path network', () => {
    it('stays a subset of the tactical network on curated inferno floors', () => {
        const samples = [
            { floor: 5, runSeed: 'golden-watch-1', floorSeed: 'golden-watch-1:5' },
            { floor: 8, runSeed: 'golden-escape-a', floorSeed: 'golden-escape-a:8' },
            { floor: 10, runSeed: 'golden-boss-1', floorSeed: 'golden-boss-1:10' }
        ];

        samples.forEach(({ floor, runSeed, floorSeed }) => {
            const result = compileStandaloneFloor(floor, floorSeed, {
                generationState: createGenerationState(runSeed)
            });
            const pathNetwork = result.artifact.pathNetwork;
            const tacticalTiles = new Set(pathNetwork.tacticalTileKeys);
            const tacticalEdges = new Set(pathNetwork.tacticalEdges.map((edge) => buildEdgeKey(edge.fromKey, edge.toKey)));

            expect(pathNetwork.visualTileKeys.length).toBeGreaterThan(0);
            expect(pathNetwork.visualTileKeys.length).toBeLessThanOrEqual(pathNetwork.tacticalTileKeys.length);

            pathNetwork.visualTileKeys.forEach((tileKey) => {
                expect(tacticalTiles.has(tileKey)).toBe(true);
            });

            pathNetwork.visualEdges.forEach((edge) => {
                expect(tacticalEdges.has(buildEdgeKey(edge.fromKey, edge.toKey))).toBe(true);
            });

            pathNetwork.landmarks
                .filter((landmark) => landmark.onPath)
                .forEach((landmark) => {
                    expect(pathNetwork.visualTileKeys).toContain(pointToKey(landmark.point));
                });
        });
    });

    it('keeps tactical spur-only tiles out of the visual route', () => {
        const result = compileStandaloneFloor(8, 'golden-escape-a:8', {
            generationState: createGenerationState('golden-escape-a')
        });
        const pathNetwork = result.artifact.pathNetwork;
        const tacticalOnlyTiles = pathNetwork.segments
            .filter((segment) => segment.kind === 'spur')
            .flatMap((segment) => segment.tileKeys)
            .filter((tileKey) => !pathNetwork.visualTileKeys.includes(tileKey));

        expect(tacticalOnlyTiles.length).toBeGreaterThan(0);
        tacticalOnlyTiles.forEach((tileKey) => {
            expect(pathNetwork.visualTileKeys).not.toContain(tileKey);
        });
    });
});
