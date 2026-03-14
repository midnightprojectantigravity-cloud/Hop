import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
    runBatch,
    summarizeBatch,
    type ArchetypeLoadoutId,
    type BotPolicy,
    type RunResult
} from '../src/systems/evaluation/balance-harness';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';

const round4 = (value: number): number => Number(value.toFixed(4));

const count = Number(process.argv[2] || 24);
const maxTurns = Number(process.argv[3] || 60);
const policy = (process.argv[4] || 'heuristic') as BotPolicy;
const policyProfileId = process.argv[5] || 'sp-v1-default';
const outFile = process.argv[6] || 'artifacts/ires/IRES_STRESS_REPORT.json';
const seedPrefix = process.argv[7] || `ires-stress-${policyProfileId}`;

const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];

const rankWorstRedlineRun = (left: RunResult, right: RunResult): number => {
    if ((right.sparkBurnDamage || 0) !== (left.sparkBurnDamage || 0)) {
        return (right.sparkBurnDamage || 0) - (left.sparkBurnDamage || 0);
    }
    if ((right.redlineActions || 0) !== (left.redlineActions || 0)) {
        return (right.redlineActions || 0) - (left.redlineActions || 0);
    }
    if ((right.peakExhaustion || 0) !== (left.peakExhaustion || 0)) {
        return (right.peakExhaustion || 0) - (left.peakExhaustion || 0);
    }
    return (right.directorRedlineBand || 0) - (left.directorRedlineBand || 0);
};

const archetypes = loadouts.map(loadoutId => {
    const seeds = Array.from({ length: count }, (_, i) => `${seedPrefix}-${loadoutId}-${i + 1}`);
    const runs = runBatch(seeds, policy, maxTurns, loadoutId, policyProfileId);
    const summary = summarizeBatch(runs, policy, loadoutId);
    const redlineRunRate = runs.length
        ? runs.filter(run =>
            (run.redlineActions || 0) > 0
            || (run.sparkBurnDamage || 0) > 0
            || (run.peakExhaustion || 0) >= 80
        ).length / runs.length
        : 0;
    const worstRun = [...runs].sort(rankWorstRedlineRun)[0];

    return {
        loadoutId,
        summary: {
            winRate: round4(summary.winRate),
            timeoutRate: round4(summary.timeoutRate),
            avgFloor: round4(summary.avgFloor),
            avgFinalPlayerHpRatio: round4(summary.avgFinalPlayerHpRatio),
            avgFinalSpark: round4(summary.avgFinalSpark),
            avgFinalMana: round4(summary.avgFinalMana),
            avgFinalExhaustion: round4(summary.avgFinalExhaustion),
            avgPeakExhaustion: round4(summary.avgPeakExhaustion),
            avgRestTurns: round4(summary.avgRestTurns),
            avgRedlineActions: round4(summary.avgRedlineActions),
            avgSparkBurnDamage: round4(summary.avgSparkBurnDamage),
            avgActionsPerPlayerTurn: round4(summary.avgActionsPerPlayerTurn),
            avgDirectorRedlineBand: round4(summary.avgDirectorRedlineBand),
            avgDirectorResourceStressBand: round4(summary.avgDirectorResourceStressBand)
        },
        redlineRunRate: round4(redlineRunRate),
        worstRun: worstRun ? {
            seed: worstRun.seed,
            result: worstRun.result,
            floor: worstRun.floor,
            peakExhaustion: worstRun.peakExhaustion,
            finalExhaustion: worstRun.finalExhaustion,
            redlineActions: worstRun.redlineActions,
            sparkBurnDamage: worstRun.sparkBurnDamage,
            avgActionsPerPlayerTurn: round4(worstRun.avgActionsPerPlayerTurn),
            directorRedlineBand: worstRun.directorRedlineBand
        } : null
    };
});

const mostRedline = [...archetypes].sort((a, b) =>
    b.summary.avgRedlineActions - a.summary.avgRedlineActions
    || b.redlineRunRate - a.redlineRunRate
)[0];
const mostStable = [...archetypes].sort((a, b) =>
    a.summary.avgPeakExhaustion - b.summary.avgPeakExhaustion
    || a.summary.avgSparkBurnDamage - b.summary.avgSparkBurnDamage
)[0];

const payload = {
    generatedAt: new Date().toISOString(),
    params: {
        count,
        maxTurns,
        policy,
        policyProfileId,
        seedPrefix
    },
    aggregates: {
        loadouts: archetypes.length,
        avgPeakExhaustionMean: round4(archetypes.reduce((sum, row) => sum + row.summary.avgPeakExhaustion, 0) / Math.max(1, archetypes.length)),
        avgRedlineActionsMean: round4(archetypes.reduce((sum, row) => sum + row.summary.avgRedlineActions, 0) / Math.max(1, archetypes.length)),
        avgSparkBurnDamageMean: round4(archetypes.reduce((sum, row) => sum + row.summary.avgSparkBurnDamage, 0) / Math.max(1, archetypes.length)),
        avgDirectorRedlineBandMean: round4(archetypes.reduce((sum, row) => sum + row.summary.avgDirectorRedlineBand, 0) / Math.max(1, archetypes.length)),
        mostRedlineLoadoutId: mostRedline?.loadoutId ?? null,
        mostStableLoadoutId: mostStable?.loadoutId ?? null
    },
    archetypes
};

const outPath = resolve(process.cwd(), outFile);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    wrote: outPath,
    loadouts: archetypes.length,
    mostRedlineLoadoutId: payload.aggregates.mostRedlineLoadoutId,
    mostStableLoadoutId: payload.aggregates.mostStableLoadoutId
}, null, 2));
