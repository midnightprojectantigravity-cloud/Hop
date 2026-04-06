import fs from 'node:fs';
import {
    compileDungeonLabScenario,
    runDungeonLabBatch,
    validateDungeonLabLibraryBundle,
    type DungeonLabLibraryBundleV1
} from '../src/systems/evaluation/dungeon-lab';
import {
    DUNGEON_LAB_FIXTURE_EXPECTATIONS,
    resolveDungeonLabFixtureBundlePath,
    type DungeonLabFixtureBand
} from '../src/__tests__/__fixtures__/dungeon-lab/fixture-manifest';

const requestedId = process.argv[2];

const withinBand = (value: number, band: DungeonLabFixtureBand): boolean =>
    value >= band.min && value <= band.max;

const formatBandResult = (label: string, value: number, band?: DungeonLabFixtureBand): string => {
    if (!band) return `${label}: ${value}`;
    return `${withinBand(value, band) ? 'PASS' : 'FAIL'} ${label}: ${value} (expected ${band.min}-${band.max})`;
};

for (const fixture of DUNGEON_LAB_FIXTURE_EXPECTATIONS) {
    if (requestedId && fixture.id !== requestedId) continue;

    const bundlePath = resolveDungeonLabFixtureBundlePath(fixture.bundleFile);
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8')) as DungeonLabLibraryBundleV1;
    const validation = validateDungeonLabLibraryBundle(bundle);
    if (!validation.valid) {
        console.log(`\n[${fixture.id}] INVALID`);
        for (const issue of validation.issues) {
            console.log(`- ${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}`);
        }
        continue;
    }

    const scenario = compileDungeonLabScenario(bundle, fixture.floorId, fixture.simulation);
    const summary = runDungeonLabBatch(scenario);

    console.log(`\n[${fixture.id}]`);
    console.log(formatBandResult('winRate', summary.winRate, fixture.metrics.winRate));
    console.log(formatBandResult('timeoutRate', summary.timeoutRate, fixture.metrics.timeoutRate));
    console.log(formatBandResult('medianSurvivalTurns', summary.medianSurvivalTurns, fixture.metrics.medianSurvivalTurns));
    console.log(formatBandResult('p95DamageDealt', summary.p95DamageDealt, fixture.metrics.p95DamageDealt));
    console.log(formatBandResult('p95DamageTaken', summary.p95DamageTaken, fixture.metrics.p95DamageTaken));
    console.log(formatBandResult('avgFirstContactTurn', summary.avgFirstContactTurn, fixture.metrics.avgFirstContactTurn));
    console.log(formatBandResult('avgFirstDamageTurn', summary.avgFirstDamageTurn, fixture.metrics.avgFirstDamageTurn));
    console.log(formatBandResult('focus.endedAliveRate', summary.focusActorMetrics?.endedAliveRate || 0, fixture.focus.endedAliveRate));
    console.log(`focus.resultCounts: ${JSON.stringify(summary.focusActorMetrics?.resultCounts || {})}`);
    console.log(`retainedArtifacts: ${summary.retainedArtifacts.length}`);
}
