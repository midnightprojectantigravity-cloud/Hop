import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface SweepSummaryRow {
    loadoutId: string;
    upa: number;
    summary: {
        winRate: number;
        timeoutRate: number;
        avgFloor: number;
        avgHazardBreaches: number;
        avgTurnsToWin: number;
        avgTurnsToLoss: number;
        avgFinalPlayerHpRatio: number;
        avgPlayerSkillCastsPerRun: number;
    };
}

interface SweepArtifact {
    generatedAt: string;
    params: {
        count: number;
        maxTurns: number;
        policy: string;
        policyProfileId: string;
        seedPrefix: string;
        trinityProfile: string;
    };
    aggregates: {
        weakestAvgFloor: number;
        weakestLoadoutId: string;
    };
    archetypes: SweepSummaryRow[];
}

const baselineFile = process.argv[2] || 'artifacts/upa/UPA_TUNING_BASELINE.json';
const candidateFile = process.argv[3] || 'artifacts/upa/UPA_TUNING_CANDIDATE.json';
const weakestDeltaMin = Number(process.argv[4] || 0.3);
const focusArchetype = process.argv[5] || 'ASSASSIN';
const focusDeltaMin = Number(process.argv[6] || 0.3);
const strict = (process.argv[7] || '1') === '1';
const outFile = process.argv[8] || 'artifacts/upa/UPA_TUNING_GATE_REPORT.json';

const loadArtifact = (file: string): SweepArtifact => {
    const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
    return JSON.parse(raw) as SweepArtifact;
};

const baseline = loadArtifact(baselineFile);
const candidate = loadArtifact(candidateFile);

const beforeMap = new Map(baseline.archetypes.map(a => [a.loadoutId, a]));
const afterMap = new Map(candidate.archetypes.map(a => [a.loadoutId, a]));

const eps = 1e-9;
const regressions: Array<{ loadoutId: string; metric: string; before: number; after: number }> = [];
const deltas: Array<{ loadoutId: string; avgFloorDelta: number; winRateDelta: number; timeoutRateDelta: number }> = [];

for (const [loadoutId, before] of beforeMap.entries()) {
    const after = afterMap.get(loadoutId);
    if (!after) {
        regressions.push({ loadoutId, metric: 'missing_after', before: 1, after: 0 });
        continue;
    }

    if (after.summary.avgFloor + eps < before.summary.avgFloor) {
        regressions.push({
            loadoutId,
            metric: 'avgFloor',
            before: before.summary.avgFloor,
            after: after.summary.avgFloor,
        });
    }
    if (after.summary.winRate + eps < before.summary.winRate) {
        regressions.push({
            loadoutId,
            metric: 'winRate',
            before: before.summary.winRate,
            after: after.summary.winRate,
        });
    }
    if (after.summary.timeoutRate > before.summary.timeoutRate + eps) {
        regressions.push({
            loadoutId,
            metric: 'timeoutRate',
            before: before.summary.timeoutRate,
            after: after.summary.timeoutRate,
        });
    }

    deltas.push({
        loadoutId,
        avgFloorDelta: Number((after.summary.avgFloor - before.summary.avgFloor).toFixed(4)),
        winRateDelta: Number((after.summary.winRate - before.summary.winRate).toFixed(4)),
        timeoutRateDelta: Number((after.summary.timeoutRate - before.summary.timeoutRate).toFixed(4)),
    });
}

const minBefore = Math.min(...baseline.archetypes.map(a => a.summary.avgFloor));
const minAfter = Math.min(...candidate.archetypes.map(a => a.summary.avgFloor));
const weakestDelta = Number((minAfter - minBefore).toFixed(4));

const beforeFocus = beforeMap.get(focusArchetype);
const afterFocus = afterMap.get(focusArchetype);
const focusDelta = beforeFocus && afterFocus
    ? Number((afterFocus.summary.avgFloor - beforeFocus.summary.avgFloor).toFixed(4))
    : Number.NaN;

const unmetChecks: string[] = [];
if (weakestDelta + eps < weakestDeltaMin) {
    unmetChecks.push(`weakest_avgFloor_delta < ${weakestDeltaMin} (actual=${weakestDelta})`);
}
if (!Number.isFinite(focusDelta) || focusDelta + eps < focusDeltaMin) {
    unmetChecks.push(`${focusArchetype}_avgFloor_delta < ${focusDeltaMin} (actual=${focusDelta})`);
}

const passed = regressions.length === 0 && unmetChecks.length === 0;

const report = {
    generatedAt: new Date().toISOString(),
    inputs: {
        baselineFile,
        candidateFile,
        weakestDeltaMin,
        focusArchetype,
        focusDeltaMin,
        strict,
    },
    baseline: {
        generatedAt: baseline.generatedAt,
        params: baseline.params,
        weakestAvgFloor: baseline.aggregates.weakestAvgFloor,
        weakestLoadoutId: baseline.aggregates.weakestLoadoutId,
    },
    candidate: {
        generatedAt: candidate.generatedAt,
        params: candidate.params,
        weakestAvgFloor: candidate.aggregates.weakestAvgFloor,
        weakestLoadoutId: candidate.aggregates.weakestLoadoutId,
    },
    weakestDelta,
    focusArchetypeDelta: focusDelta,
    deltas,
    regressions,
    unmetChecks,
    passed,
};

const outPath = resolve(process.cwd(), outFile);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    wrote: outPath,
    passed,
    regressions: regressions.length,
    unmetChecks: unmetChecks.length,
    weakestDelta,
    focusArchetype,
    focusArchetypeDelta: focusDelta,
}, null, 2));

if (strict && !passed) {
    process.exitCode = 2;
}
