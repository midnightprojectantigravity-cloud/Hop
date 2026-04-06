import fs from 'node:fs';
import path from 'node:path';
import {
    compileDungeonLabScenario,
    runDungeonLabBatch,
    runDungeonLabScenario,
    type DungeonLabLibraryBundleV1
} from '../src/systems/evaluation/dungeon-lab';
import { safeStringify } from '../src/systems/serialization';

type CliMode = 'single' | 'batch';

const bundlePathArg = process.argv[2];
const floorId = process.argv[3];
const mode = (process.argv[4] || 'single') as CliMode;

if (!bundlePathArg || !floorId) {
    throw new Error('Usage: npx tsx packages/engine/scripts/runDungeonLabScenario.ts <bundlePath> <floorId> [single|batch] [--batchCount N] [--maxTurns N] [--policy heuristic|random] [--policyProfileId ID] [--focusActorId ID]');
}

const extraArgs = process.argv.slice(5);
const fullOutput = extraArgs.includes('--full');

const readArg = (flag: string): string | undefined => {
    const index = extraArgs.indexOf(flag);
    if (index < 0) return undefined;
    return extraArgs[index + 1];
};

const resolveNumberArg = (flag: string, fallback: number): number => {
    const raw = readArg(flag);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const resolveBundle = (rawPath: string): DungeonLabLibraryBundleV1 => {
    const absolutePath = path.resolve(process.cwd(), rawPath);
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as DungeonLabLibraryBundleV1;
    if (parsed?.version !== 'dungeon-lab-library-v1') {
        throw new Error(`Expected DungeonLabLibraryBundleV1 at ${absolutePath}`);
    }
    return parsed;
};

const bundle = resolveBundle(bundlePathArg);
const scenario = compileDungeonLabScenario(bundle, floorId, {
    policy: (readArg('--policy') || 'heuristic') as 'heuristic' | 'random',
    policyProfileId: readArg('--policyProfileId') || 'sp-v1-default',
    batchCount: resolveNumberArg('--batchCount', 8),
    maxTurns: resolveNumberArg('--maxTurns', 48),
    ...(readArg('--focusActorId') ? { focusActorId: readArg('--focusActorId') } : {})
});

if (mode === 'batch') {
    const summary = runDungeonLabBatch(scenario);
    if (fullOutput) {
        console.log(safeStringify(summary));
    } else {
        console.log(safeStringify({
            version: summary.version,
            floorId: summary.scenario.floorId,
            games: summary.games,
            winRate: summary.winRate,
            timeoutRate: summary.timeoutRate,
            medianSurvivalTurns: summary.medianSurvivalTurns,
            p95DamageDealt: summary.p95DamageDealt,
            p95DamageTaken: summary.p95DamageTaken,
            avgFirstContactTurn: summary.avgFirstContactTurn,
            avgFirstDamageTurn: summary.avgFirstDamageTurn,
            focusActorMetrics: summary.focusActorMetrics,
            runs: summary.runs.map(run => ({
                seed: run.seed,
                result: run.result,
                turnsSpent: run.turnsSpent,
                damageDealt: run.damageDealt,
                damageTaken: run.damageTaken,
                focus: run.focus
            })),
            retainedArtifacts: summary.retainedArtifacts.map(artifact => ({
                seed: artifact.seed,
                retainedReason: artifact.retainedReason,
                result: artifact.run.result,
                turnsSpent: artifact.run.turnsSpent,
                finalFingerprint: artifact.finalFingerprint
            }))
        }));
    }
} else {
    const seed = readArg('--seed');
    const artifact = runDungeonLabScenario(scenario, seed);
    if (fullOutput) {
        console.log(safeStringify(artifact));
    } else {
        console.log(safeStringify({
            version: artifact.version,
            floorId: artifact.scenario.floorId,
            seed: artifact.seed,
            result: artifact.run.result,
            turnsSpent: artifact.run.turnsSpent,
            score: artifact.run.score,
            metrics: artifact.metrics,
            actionCount: artifact.actionLog.length,
            checkpointCount: artifact.checkpoints.length,
            finalFingerprint: artifact.finalFingerprint
        }));
    }
}
