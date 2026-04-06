import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    compileDungeonLabScenario,
    compileDungeonLabState,
    inspectDungeonLabPreview,
    runDungeonLabBatch,
    validateDungeonLabLibraryBundle,
    type DungeonLabLibraryBundleV1
} from '../systems/evaluation/dungeon-lab';
import {
    DUNGEON_LAB_FIXTURE_EXPECTATIONS,
    resolveDungeonLabFixtureBundlePath,
    type DungeonLabFixtureBand
} from './__fixtures__/dungeon-lab/fixture-manifest';

const expectBand = (value: number, band: DungeonLabFixtureBand, label: string): void => {
    expect(
        value >= band.min && value <= band.max,
        `${label} expected ${band.min}-${band.max} but got ${value}`
    ).toBe(true);
};

const loadBundle = (bundleFile: string): DungeonLabLibraryBundleV1 =>
    JSON.parse(fs.readFileSync(resolveDungeonLabFixtureBundlePath(bundleFile), 'utf8')) as DungeonLabLibraryBundleV1;

describe('Dungeon Lab fixture regressions', () => {
    for (const fixture of DUNGEON_LAB_FIXTURE_EXPECTATIONS) {
        it(`keeps ${fixture.id} inside its authored matchup bands`, () => {
            const bundle = loadBundle(fixture.bundleFile);
            const validation = validateDungeonLabLibraryBundle(bundle);
            expect(validation.valid).toBe(true);

            const scenario = compileDungeonLabScenario(bundle, fixture.floorId, fixture.simulation);
            const preview = inspectDungeonLabPreview(scenario, { allowEntityFallback: true });
            expect(preview.issues.filter(issue => issue.severity === 'error')).toHaveLength(0);

            const compiled = compileDungeonLabState(scenario);
            if (fixture.structural.exactEnemyCount !== undefined) {
                expect(compiled.enemies).toHaveLength(fixture.structural.exactEnemyCount);
            }
            if (fixture.structural.generatedEnemyCountExceedsAuthored) {
                expect(compiled.enemies.length).toBeGreaterThan(fixture.structural.authoredEnemyCount);
            }

            const summary = runDungeonLabBatch(scenario);
            expect(summary.games).toBe(fixture.simulation.batchCount);
            expect(summary.runs.map(run => run.seed)).toEqual(
                Array.from({ length: fixture.simulation.batchCount }, (_, index) => `${scenario.floor.seed}::dungeon-lab::${index + 1}`)
            );
            expect(summary.focusActorMetrics?.sourceActorId).toBe(fixture.simulation.focusActorId);

            expectBand(summary.winRate, fixture.metrics.winRate, `${fixture.id} winRate`);
            expectBand(summary.timeoutRate, fixture.metrics.timeoutRate, `${fixture.id} timeoutRate`);
            expectBand(summary.medianSurvivalTurns, fixture.metrics.medianSurvivalTurns, `${fixture.id} medianSurvivalTurns`);
            if (fixture.metrics.p95DamageDealt) {
                expectBand(summary.p95DamageDealt, fixture.metrics.p95DamageDealt, `${fixture.id} p95DamageDealt`);
            }
            if (fixture.metrics.p95DamageTaken) {
                expectBand(summary.p95DamageTaken, fixture.metrics.p95DamageTaken, `${fixture.id} p95DamageTaken`);
            }
            if (fixture.metrics.avgFirstContactTurn) {
                expectBand(summary.avgFirstContactTurn, fixture.metrics.avgFirstContactTurn, `${fixture.id} avgFirstContactTurn`);
            }
            if (fixture.metrics.avgFirstDamageTurn) {
                expectBand(summary.avgFirstDamageTurn, fixture.metrics.avgFirstDamageTurn, `${fixture.id} avgFirstDamageTurn`);
            }

            expectBand(summary.focusActorMetrics?.endedAliveRate || 0, fixture.focus.endedAliveRate, `${fixture.id} focus endedAliveRate`);
            expect(summary.focusActorMetrics?.resultCounts).toEqual(fixture.focus.resultCounts);

            if (fixture.openingPressure) {
                expect(summary.avgFirstContactTurn).toBeLessThanOrEqual(fixture.openingPressure.maxFirstContactTurn);
                expect(summary.avgFirstDamageTurn).toBeLessThanOrEqual(fixture.openingPressure.maxFirstDamageTurn);
                expect(summary.runs.every(run => run.turnsSpent >= fixture.openingPressure!.minTurnsSpent)).toBe(true);
                if (fixture.openingPressure.forbidTimeouts) {
                    expect(summary.runs.every(run => run.result !== 'timeout')).toBe(true);
                }
            }
        }, 900000);
    }
});
