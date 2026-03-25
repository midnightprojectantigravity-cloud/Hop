import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { compileStandaloneFloor, createCompilerSession, createGenerationState } from '../generation';

const summarizeTiles = (tiles: Map<string, { baseId: string }>) =>
    Array.from(tiles.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, tile]) => `${key}:${tile.baseId}`);

const createSyntheticTile = (baseId: 'STONE' | 'WALL', position: ReturnType<typeof createHex>) => ({
    baseId,
    position,
    traits: new Set(baseId === 'WALL' ? ['BLOCKS_MOVEMENT', 'BLOCKS_LOS'] : ['WALKABLE']),
    effects: []
});

const getRuntimeSessionState = (session: ReturnType<typeof createCompilerSession>) =>
    session.getState() as any;

const advanceSessionToPass = (
    session: ReturnType<typeof createCompilerSession>,
    pass: string
) => {
    while (!session.isComplete() && getRuntimeSessionState(session).currentPass !== pass) {
        session.step(1);
    }
    expect(getRuntimeSessionState(session).currentPass).toBe(pass);
};

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

    it('preserves hard-claim tiles when optional gaskets close over them', () => {
        const session = createCompilerSession({
            floor: 1,
            seed: 'world-compiler-hard-claim-gasket'
        });

        advanceSessionToPass(session, 'realizeSceneEvidence');
        const runtimeState = getRuntimeSessionState(session);
        const gasketAnchor = createHex(6, 6);
        const gasketPoint = createHex(7, 7);
        const gasketKey = pointToKey(gasketPoint);

        runtimeState.theme = 'inferno';
        runtimeState.modulePlan = {
            placements: [{
                moduleId: 'inferno_watch_post',
                slotId: 'watch_slot',
                anchor: gasketAnchor,
                footprintKeys: [],
                onPath: false
            }]
        };
        runtimeState.claims = [{
            id: 'primary_slot:reset_lane',
            kind: 'reset_access',
            hardness: 'hard',
            sourceModuleId: 'inferno_reset_pocket',
            from: gasketPoint,
            to: gasketPoint,
            cells: [gasketPoint]
        }];
        runtimeState.realizedTiles = new Map([
            [gasketKey, createSyntheticTile('STONE', gasketPoint)]
        ]);

        session.step(1);

        const closedState = getRuntimeSessionState(session);
        expect(closedState.currentPass).toBe('closeUnresolvedGaskets');
        expect(closedState.realizedTiles?.get(gasketKey)?.baseId).toBe('STONE');
    });

    it('keeps environmental pressure off hard reset lanes', () => {
        const session = createCompilerSession({
            floor: 1,
            seed: 'world-compiler-hard-claim-pressure'
        });

        advanceSessionToPass(session, 'buildVisualPathNetwork');
        const runtimeState = getRuntimeSessionState(session);
        const center = createHex(30, 30);
        const centerKey = pointToKey(center);
        const claimCells = [createHex(31, 30), createHex(30, 31)];
        const claimKeys = claimCells.map(pointToKey);
        const routedKeys = [
            pointToKey(createHex(31, 29)),
            pointToKey(createHex(30, 29)),
            pointToKey(createHex(29, 30)),
            pointToKey(createHex(29, 31))
        ];

        runtimeState.claims = [{
            id: 'primary_slot:reset_lane',
            kind: 'reset_access',
            hardness: 'hard',
            sourceModuleId: 'inferno_reset_pocket',
            from: claimCells[0],
            to: claimCells[1],
            cells: claimCells
        }];
        runtimeState.realizedTiles = new Map([
            [centerKey, createSyntheticTile('STONE', center)],
            [claimKeys[0], createSyntheticTile('STONE', claimCells[0]!)],
            [claimKeys[1], createSyntheticTile('STONE', claimCells[1]!)],
            [routedKeys[0], createSyntheticTile('STONE', createHex(31, 29))],
            [routedKeys[1], createSyntheticTile('STONE', createHex(30, 29))],
            [routedKeys[2], createSyntheticTile('STONE', createHex(29, 30))],
            [routedKeys[3], createSyntheticTile('STONE', createHex(29, 31))]
        ]);
        runtimeState.pathNetworkValue = {
            landmarks: [],
            tacticalTileKeys: routedKeys,
            tacticalEdges: [],
            visualTileKeys: [],
            visualEdges: [],
            segments: [{
                id: 'primary-segment',
                fromLandmarkId: 'start',
                toLandmarkId: 'exit',
                tileKeys: [centerKey],
                edges: [],
                kind: 'primary',
                routeMembership: 'primary'
            }],
            routeCount: 1,
            junctionTileKeys: [centerKey],
            maxStraightRun: 1,
            environmentalPressureClusters: []
        };
        runtimeState.intent = {
            ...runtimeState.intent,
            role: 'pressure_spike',
            routeProfile: {
                ...runtimeState.intent!.routeProfile,
                obstacleClusterBudget: 1,
                trapClusterBudget: 0,
                maxStraightRun: 3,
                saferRouteBias: 'none',
                riskierRouteBias: 'none'
            }
        };

        session.step(1);

        const pressuredState = getRuntimeSessionState(session);
        expect(pressuredState.currentPass).toBe('applyEnvironmentalPressure');
        expect(pressuredState.realizedTiles?.get(claimKeys[0])?.baseId).toBe('STONE');
        expect(pressuredState.realizedTiles?.get(claimKeys[1])?.baseId).toBe('STONE');
        expect(pressuredState.pathNetworkValue?.environmentalPressureClusters).toHaveLength(0);
    });
});
