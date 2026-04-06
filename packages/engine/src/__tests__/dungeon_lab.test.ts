import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fingerprintFromState } from '../logic';
import { validateReplayEnvelopeV3 } from '../systems/replay-validation';
import {
    compileDungeonLabScenario,
    compileDungeonLabState,
    inspectDungeonLabPreview,
    materializeDungeonLabArtifactState,
    runDungeonLabBatch,
    runDungeonLabLiveSession,
    runDungeonLabScenario,
    type DungeonLabLibraryBundleV1
} from '../systems/evaluation/dungeon-lab';
import {
    DUNGEON_LAB_FIXTURE_EXPECTATIONS,
    resolveDungeonLabFixtureBundlePath
} from './__fixtures__/dungeon-lab/fixture-manifest';

const createBaseBundle = (): DungeonLabLibraryBundleV1 => ({
    version: 'dungeon-lab-library-v1',
    entities: [
        {
            id: 'vanguard',
            name: 'Vanguard',
            trinity: { body: 16, instinct: 10, mind: 4 },
            skillIds: ['BASIC_MOVE', 'BASIC_ATTACK']
        },
        {
            id: 'butcher',
            name: 'Butcher',
            trinity: { body: 20, instinct: 29, mind: 0 },
            skillIds: ['BASIC_MOVE', 'BASIC_ATTACK']
        }
    ],
    prefabs: [],
    floors: [
        {
            id: 'floor10-duel',
            name: 'Floor 10 Duel',
            seed: 'dungeon-lab-floor10-seed',
            floor: 10,
            themeId: 'inferno',
            mapSize: { width: 9, height: 11 },
            mapShape: 'diamond',
            prefabPlacements: [],
            looseActorPlacements: [
                {
                    id: 'vanguard',
                    entityId: 'vanguard',
                    side: 'player',
                    position: { q: 4, r: 5, s: -9 },
                    goal: 'engage'
                },
                {
                    id: 'butcher',
                    entityId: 'butcher',
                    side: 'enemy',
                    position: { q: 5, r: 2, s: -7 },
                    goal: 'engage',
                    subtypeRef: 'butcher'
                }
            ],
            objectiveOverrides: {
                shrinePosition: null,
                stairsPosition: { q: 4, r: 5, s: -9 }
            },
            spawnFillPolicy: 'none'
        }
    ]
});

const loadFixtureBundle = (bundleFile: string): DungeonLabLibraryBundleV1 =>
    JSON.parse(fs.readFileSync(resolveDungeonLabFixtureBundlePath(bundleFile), 'utf8')) as DungeonLabLibraryBundleV1;

describe('Dungeon Lab', () => {
    it('allows preview fallback for missing entity references and surfaces marker diagnostics', () => {
        const bundle = createBaseBundle();
        bundle.floors[0] = {
            ...bundle.floors[0],
            looseActorPlacements: [
                bundle.floors[0].looseActorPlacements[0],
                {
                    id: 'ghost',
                    entityId: 'missing-entity',
                    side: 'enemy',
                    position: { q: 5, r: 2, s: -7 },
                    goal: 'engage'
                }
            ]
        };
        const scenario = compileDungeonLabScenario(bundle, 'floor10-duel');

        const preview = inspectDungeonLabPreview(scenario, { allowEntityFallback: true });
        expect(preview.state.enemies).toHaveLength(1);
        expect(preview.issues.some(issue => issue.code === 'MISSING_ENTITY_REFERENCE')).toBe(true);
        expect(preview.markers.some(marker => marker.kind === 'missing_entity')).toBe(true);

        expect(() => compileDungeonLabState(scenario, { allowEntityFallback: false })).toThrow(/missing entity/i);
        expect(() => runDungeonLabScenario(scenario)).toThrow(/missing entity/i);
        expect(() => runDungeonLabBatch(scenario)).toThrow(/missing entity/i);
        const live = runDungeonLabLiveSession(scenario);
        expect(() => live.next()).toThrow(/missing entity/i);
    });

    it('surfaces unreachable objectives in preview and blocks simulation compilation', () => {
        const bundle = createBaseBundle();
        bundle.prefabs.push({
            id: 'seal-ring',
            name: 'Seal Ring',
            tileEdits: [
                { dq: 1, dr: 0, baseId: 'WALL' },
                { dq: 1, dr: -1, baseId: 'WALL' },
                { dq: 0, dr: -1, baseId: 'WALL' },
                { dq: -1, dr: 0, baseId: 'WALL' },
                { dq: -1, dr: 1, baseId: 'WALL' },
                { dq: 0, dr: 1, baseId: 'WALL' }
            ],
            actorPlacements: []
        });
        bundle.floors[0] = {
            ...bundle.floors[0],
            prefabPlacements: [{
                id: 'seal-player',
                prefabId: 'seal-ring',
                anchor: { q: 4, r: 5, s: -9 }
            }],
            objectiveOverrides: {
                shrinePosition: null,
                stairsPosition: { q: 4, r: 2, s: -6 }
            }
        };
        const scenario = compileDungeonLabScenario(bundle, 'floor10-duel');

        const preview = inspectDungeonLabPreview(scenario, { allowEntityFallback: true });
        expect(preview.issues.some(issue => issue.code === 'MAP_PATHING_ERROR')).toBe(true);
        expect(preview.markers.some(marker => marker.kind === 'stairs_unreachable')).toBe(true);

        expect(() => compileDungeonLabState(scenario)).toThrow(/Map Pathing Error/i);
        expect(() => runDungeonLabScenario(scenario)).toThrow(/Map Pathing Error/i);
        expect(() => runDungeonLabBatch(scenario)).toThrow(/Map Pathing Error/i);
        const live = runDungeonLabLiveSession(scenario);
        expect(() => live.next()).toThrow(/Map Pathing Error/i);
    });

    it('compiles deterministically for the same seed and keeps control floors authored-only when spawn fill is none', () => {
        const bundle = createBaseBundle();
        const scenario = compileDungeonLabScenario(bundle, 'floor10-duel');

        const first = compileDungeonLabState(scenario);
        const second = compileDungeonLabState(scenario);

        expect(first.enemies).toHaveLength(1);
        expect(first.enemies[0]?.subtype).toBe('butcher');
        expect(fingerprintFromState(first)).toBe(fingerprintFromState(second));
        expect(first.player.position).toEqual({ q: 4, r: 5, s: -9 });
    });

    it('supports per-actor trinity and skill overrides without mutating the shared entity template', () => {
        const bundle: DungeonLabLibraryBundleV1 = {
            version: 'dungeon-lab-library-v1',
            entities: [
                {
                    id: 'grunt',
                    name: 'Grunt',
                    trinity: { body: 10, instinct: 10, mind: 10 },
                    skillIds: ['BASIC_MOVE', 'BASIC_ATTACK']
                }
            ],
            prefabs: [],
            floors: [
                {
                    id: 'override-floor',
                    name: 'Override Floor',
                    seed: 'actor-override-seed',
                    floor: 5,
                    themeId: 'inferno',
                    mapSize: { width: 9, height: 11 },
                    mapShape: 'diamond',
                    prefabPlacements: [],
                    looseActorPlacements: [
                        {
                            id: 'player-grunt',
                            entityId: 'grunt',
                            side: 'player',
                            position: { q: 4, r: 5, s: -9 },
                            goal: 'engage'
                        },
                        {
                            id: 'enemy-grunt',
                            entityId: 'grunt',
                            side: 'enemy',
                            position: { q: 5, r: 5, s: -10 },
                            goal: 'engage',
                            overrides: {
                                trinity: { body: 20, instinct: 0, mind: 20 },
                                skillIds: ['BASIC_MOVE', 'BASIC_ATTACK', 'JUMP']
                            }
                        }
                    ],
                    objectiveOverrides: {
                        shrinePosition: null,
                        stairsPosition: { q: 4, r: 5, s: -9 }
                    },
                    spawnFillPolicy: 'none'
                }
            ]
        };

        const scenario = compileDungeonLabScenario(bundle, 'override-floor');
        const state = compileDungeonLabState(scenario);
        const enemy = state.enemies.find(actor => actor.id === 'enemy-grunt');

        expect(enemy?.maxHp).toBeGreaterThan(state.player.maxHp);
        expect(state.player.activeSkills.some(skill => skill.id === 'JUMP')).toBe(false);
        expect(enemy?.activeSkills.some(skill => skill.id === 'JUMP')).toBe(true);
        expect(bundle.entities[0].trinity).toEqual({ body: 10, instinct: 10, mind: 10 });
        expect(bundle.entities[0].skillIds).toEqual(['BASIC_MOVE', 'BASIC_ATTACK']);
    });

    it('derives deterministic per-run batch seeds and focus metrics with explicit outcome context', () => {
        const bundle = createBaseBundle();
        const scenario = compileDungeonLabScenario(bundle, 'floor10-duel', {
            batchCount: 3,
            maxTurns: 12,
            focusActorId: 'vanguard'
        });

        const first = runDungeonLabBatch(scenario);
        const second = runDungeonLabBatch(scenario);

        expect(first.runs.map(run => run.seed)).toEqual([
            'dungeon-lab-floor10-seed::dungeon-lab::1',
            'dungeon-lab-floor10-seed::dungeon-lab::2',
            'dungeon-lab-floor10-seed::dungeon-lab::3'
        ]);
        expect(first.runs).toEqual(second.runs);
        expect(first.focusActorMetrics?.sourceActorId).toBe('vanguard');
        expect(first.focusActorMetrics?.resultCounts).toBeDefined();
        expect(first.retainedArtifacts.every(artifact => first.runs.some(run => run.seed === artifact.seed))).toBe(true);
    });

    it('keeps live session and single-run artifact final fingerprints aligned for the same seed', () => {
        const bundle = createBaseBundle();
        const scenario = compileDungeonLabScenario(bundle, 'floor10-duel', {
            maxTurns: 10,
            batchCount: 1,
            focusActorId: 'vanguard'
        });

        const single = runDungeonLabScenario(scenario, 'dungeon-lab-live-parity');
        const live = runDungeonLabLiveSession(scenario, 'dungeon-lab-live-parity');
        let final = live.next();
        while (!final.done) {
            final = live.next();
        }

        expect(final.value.finalFingerprint).toBe(single.finalFingerprint);
        expect(fingerprintFromState(final.value.finalState)).toBe(single.finalFingerprint);
    });

    it('replays the retained full Floor 10 fixture artifact without drifting from the final fingerprint', () => {
        const fixture = DUNGEON_LAB_FIXTURE_EXPECTATIONS.find(
            candidate => candidate.id === 'floor10_vanguard_vs_butcher_full'
        );
        expect(fixture).toBeDefined();

        const bundle = loadFixtureBundle(fixture!.bundleFile);
        const scenario = compileDungeonLabScenario(bundle, fixture!.floorId, fixture!.simulation);
        const summary = runDungeonLabBatch(scenario);
        expect(summary.retainedArtifacts.length).toBeGreaterThan(0);
        const artifact = summary.retainedArtifacts[0];
        const replayValidation = validateReplayEnvelopeV3(artifact.replayEnvelope);

        expect(replayValidation.valid).toBe(true);
        const replayedFinal = materializeDungeonLabArtifactState(artifact, artifact.actionLog.length);
        expect(fingerprintFromState(replayedFinal)).toBe(artifact.finalFingerprint);
        expect(artifact.metrics.focus?.endedAlive).toBe((artifact.finalState.player.hp || 0) > 0);
        expect(artifact.metrics.focus?.runResult).toBe(artifact.run.result);
        expect(artifact.metrics.focus?.finalGameStatus).toBe(artifact.finalState.gameStatus);
    });
});
