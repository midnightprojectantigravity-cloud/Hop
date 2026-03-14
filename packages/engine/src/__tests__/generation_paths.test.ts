import { describe, expect, it } from 'vitest';
import { pointToKey } from '../hex';
import { compileStandaloneFloor, createGenerationState, hexDistanceInt } from '../generation';

const curatedFloors = [
    { floor: 1, runSeed: 'golden-open-1', floorSeed: 'golden-open-1' },
    { floor: 5, runSeed: 'golden-watch-1', floorSeed: 'golden-watch-1:5' },
    { floor: 8, runSeed: 'golden-escape-a', floorSeed: 'golden-escape-a:8' },
    { floor: 10, runSeed: 'golden-boss-1', floorSeed: 'golden-boss-1:10' }
];

const parseHexKey = (key: string) => {
    const [q, r] = key.split(',').map(Number);
    return { q, r, s: -q - r };
};

const isWalkableTileKey = (tiles: Map<string, { baseId: string; traits: Set<string> }>, key: string): boolean => {
    const tile = tiles.get(key);
    return Boolean(tile && tile.baseId !== 'VOID' && !tile.traits.has('BLOCKS_MOVEMENT'));
};

describe('generated tactical paths', () => {
    it.each(curatedFloors)('keeps every routed segment walkable on floor $floor', ({ floor, runSeed, floorSeed }) => {
        const result = compileStandaloneFloor(floor, floorSeed, {
            generationState: createGenerationState(runSeed)
        });

        expect(result.verificationReport.code).toBe('OK');

        const pathNetwork = result.artifact.pathNetwork;
        const entry = pathNetwork.landmarks.find((landmark) => landmark.id === 'entry');
        const exit = pathNetwork.landmarks.find((landmark) => landmark.id === 'exit');

        expect(entry?.onPath).toBe(true);
        expect(exit?.onPath).toBe(true);
        expect(pathNetwork.visualTileKeys).toContain(pointToKey(entry!.point));
        expect(pathNetwork.visualTileKeys).toContain(pointToKey(exit!.point));

        pathNetwork.tacticalTileKeys.forEach((tileKey) => {
            expect(isWalkableTileKey(result.dungeon.tiles as any, tileKey)).toBe(true);
        });

        pathNetwork.tacticalEdges.forEach((edge) => {
            expect(hexDistanceInt(parseHexKey(edge.fromKey), parseHexKey(edge.toKey))).toBe(1);
        });
    });

    it('keeps off-path landmarks reachable through spur segments', () => {
        const result = compileStandaloneFloor(8, 'golden-escape-a:8', {
            generationState: createGenerationState('golden-escape-a')
        });
        const pathNetwork = result.artifact.pathNetwork;
        const hiddenLandmarks = pathNetwork.landmarks.filter((landmark) => !landmark.onPath);
        const mainTileSet = new Set(pathNetwork.visualTileKeys);

        expect(hiddenLandmarks.length).toBeGreaterThan(0);

        hiddenLandmarks.forEach((landmark) => {
            expect(pathNetwork.tacticalTileKeys).toContain(pointToKey(landmark.point));
            if (!mainTileSet.has(pointToKey(landmark.point))) {
                expect(
                    pathNetwork.segments.some((segment) =>
                        segment.kind === 'spur'
                        && (segment.toLandmarkId === landmark.id || segment.fromLandmarkId === landmark.id)
                    )
                ).toBe(true);
            }
        });
    });
});
