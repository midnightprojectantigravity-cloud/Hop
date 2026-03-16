import { describe, expect, it } from 'vitest';
import { compileStandaloneFloor, createGenerationState } from '../generation';

const summarizeTiles = (tiles: Map<string, { baseId: string }>) =>
    Array.from(tiles.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, tile]) => `${key}:${tile.baseId}`);

describe('world compiler facade', () => {
    it('produces deterministic artifacts for the same floor seed', () => {
        const left = compileStandaloneFloor(4, 'world-compiler-seed');
        const right = compileStandaloneFloor(4, 'world-compiler-seed');

        expect(left.dungeon.spawnPositions).toEqual(right.dungeon.spawnPositions);
        expect(summarizeTiles(left.dungeon.tiles)).toEqual(summarizeTiles(right.dungeon.tiles));
        expect(left.dungeon.modulePlacements).toEqual(right.dungeon.modulePlacements);
        expect(left.generationState.currentFloorSummary).toEqual(right.generationState.currentFloorSummary);
        expect(left.verificationReport).toEqual(right.verificationReport);
    });

    it('emits a compiled floor summary with scene identity and verification digest', () => {
        const result = compileStandaloneFloor(5, 'world-compiler-elite');

        expect(result.generationState.currentFloorSummary?.sceneSignature.sceneId).toBeTruthy();
        expect(result.dungeon.verificationDigest).toBeTruthy();
        expect(result.generationState.currentFloorSummary?.moduleIds.length).toBeGreaterThan(0);
    });

    it('keeps ordinary inferno floors satisfiable for a stable seed sweep', () => {
        for (let floor = 1; floor <= 10; floor += 1) {
            const result = compileStandaloneFloor(floor, `world-compiler-scan-${floor}`);
            expect(result.verificationReport.code).toBe('OK');
            expect(result.failure).toBeUndefined();
        }
    });

    it('fails authored impossible slot anchors during embedding instead of late module resolution', () => {
        const result = compileStandaloneFloor(4, 'world-compiler-impossible-slot', {
            generationSpec: {
                authoredFloors: {
                    4: {
                        role: 'pressure_spike',
                        theme: 'inferno',
                        requiredTacticalTags: ['choke'],
                        requiredNarrativeTags: ['siege_breach'],
                        anchors: {
                            entry: { q: 3, r: 8, s: -11 },
                            exit: { q: 3, r: 0, s: -3 },
                            primary_slot: { q: 6, r: 1, s: -7 }
                        }
                    }
                }
            }
        });

        expect(result.failure?.stage).toBe('embedSpatialPlan');
        expect(result.failure?.code).toBe('EMBED_SLOT_UNSAT');
    });

    it('biases non-authored pressure floors toward safe-reset recovery when director redline pressure is high', () => {
        const generationState = createGenerationState('world-compiler-redline');
        generationState.directorState = {
            ...generationState.directorState,
            resourceStressBand: 3,
            redlineBand: 3
        };

        const result = compileStandaloneFloor(2, 'world-compiler-redline:2', { generationState });

        expect(result.generationState.currentFloorSummary?.role).toBe('recovery');
        expect(result.generationState.currentFloorSummary?.sceneSignature.motif).toBe('failed_escape');
        expect(result.generationState.currentFloorSummary?.parTurnTarget).toBe(16);
        expect(result.generationState.currentFloorSummary?.pathSummary.routeCount).toBeGreaterThanOrEqual(2);
        expect(
            result.generationState.currentFloorSummary?.moduleIds.some(id =>
                id === 'inferno_reset_pocket'
                || id === 'inferno_cover_band'
                || id === 'inferno_split_fork'
            )
        ).toBe(true);
    });

    it('keeps authored floor roles authoritative over director recovery bias', () => {
        const generationState = createGenerationState('world-compiler-authored-redline');
        generationState.directorState = {
            ...generationState.directorState,
            resourceStressBand: 4,
            redlineBand: 4
        };

        const result = compileStandaloneFloor(2, 'world-compiler-authored-redline:2', {
            generationState,
            generationSpec: {
                authoredFloors: {
                    2: {
                        role: 'pressure_spike',
                        theme: 'inferno',
                        requiredTacticalTags: ['choke'],
                        requiredNarrativeTags: ['siege_breach']
                    }
                }
            }
        });

        expect(result.generationState.currentFloorSummary?.role).toBe('pressure_spike');
        expect(result.generationState.currentFloorSummary?.sceneSignature.motif).toBe('siege_breach');
        expect(result.generationState.currentFloorSummary?.moduleIds.some(id => id === 'inferno_reset_pocket')).toBe(false);
    });
});
