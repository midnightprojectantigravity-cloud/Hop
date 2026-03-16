import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface IresStressSummary {
    avgFloor: number;
    avgPeakExhaustion: number;
    avgRedlineActions: number;
    avgSparkBurnDamage: number;
}

export interface IresStressArchetypeRow {
    loadoutId: string;
    summary: IresStressSummary;
    redlineRunRate: number;
}

export interface IresStressArtifact {
    generatedAt: string;
    params: {
        count: number;
        maxTurns: number;
        policy: string;
        policyProfileId: string;
        seedPrefix: string;
    };
    archetypes: IresStressArchetypeRow[];
}

export interface IresStressGateDelta {
    loadoutId: string;
    avgFloorDelta: number;
    avgPeakExhaustionDelta: number;
    avgRedlineActionsDelta: number;
    avgSparkBurnDamageDelta: number;
    redlineRunRateDelta: number;
}

export interface IresStressGateRegression {
    loadoutId: string;
    metric:
        | 'avgFloor'
        | 'avgPeakExhaustion'
        | 'avgRedlineActions'
        | 'avgSparkBurnDamage'
        | 'redlineRunRate'
        | 'missing_candidate'
        | 'unexpected_candidate'
        | 'loadout_count';
    baseline: number | string;
    candidate: number | string;
}

export interface IresStressGateReport {
    generatedAt: string;
    baseline: {
        generatedAt: string;
        params: IresStressArtifact['params'];
    };
    candidate: {
        generatedAt: string;
        params: IresStressArtifact['params'];
    };
    deltas: IresStressGateDelta[];
    regressions: IresStressGateRegression[];
    passed: boolean;
}

const round4 = (value: number): number => Number(value.toFixed(4));

export const loadIresStressArtifact = (file: string): IresStressArtifact => {
    const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
    return JSON.parse(raw) as IresStressArtifact;
};

export const buildIresStressGateReport = (
    baseline: IresStressArtifact,
    candidate: IresStressArtifact
): IresStressGateReport => {
    const regressions: IresStressGateRegression[] = [];
    const deltas: IresStressGateDelta[] = [];

    const baselineMap = new Map(baseline.archetypes.map(row => [row.loadoutId, row]));
    const candidateMap = new Map(candidate.archetypes.map(row => [row.loadoutId, row]));

    if (baseline.archetypes.length !== candidate.archetypes.length) {
        regressions.push({
            loadoutId: '__all__',
            metric: 'loadout_count',
            baseline: baseline.archetypes.length,
            candidate: candidate.archetypes.length
        });
    }

    for (const row of baseline.archetypes) {
        const candidateRow = candidateMap.get(row.loadoutId);
        if (!candidateRow) {
            regressions.push({
                loadoutId: row.loadoutId,
                metric: 'missing_candidate',
                baseline: row.loadoutId,
                candidate: 'missing'
            });
            continue;
        }

        const delta = {
            loadoutId: row.loadoutId,
            avgFloorDelta: round4(candidateRow.summary.avgFloor - row.summary.avgFloor),
            avgPeakExhaustionDelta: round4(candidateRow.summary.avgPeakExhaustion - row.summary.avgPeakExhaustion),
            avgRedlineActionsDelta: round4(candidateRow.summary.avgRedlineActions - row.summary.avgRedlineActions),
            avgSparkBurnDamageDelta: round4(candidateRow.summary.avgSparkBurnDamage - row.summary.avgSparkBurnDamage),
            redlineRunRateDelta: round4(candidateRow.redlineRunRate - row.redlineRunRate)
        };
        deltas.push(delta);

        if (candidateRow.summary.avgFloor < row.summary.avgFloor) {
            regressions.push({
                loadoutId: row.loadoutId,
                metric: 'avgFloor',
                baseline: row.summary.avgFloor,
                candidate: candidateRow.summary.avgFloor
            });
        }
        if (candidateRow.summary.avgPeakExhaustion > row.summary.avgPeakExhaustion) {
            regressions.push({
                loadoutId: row.loadoutId,
                metric: 'avgPeakExhaustion',
                baseline: row.summary.avgPeakExhaustion,
                candidate: candidateRow.summary.avgPeakExhaustion
            });
        }
        if (candidateRow.summary.avgRedlineActions > row.summary.avgRedlineActions) {
            regressions.push({
                loadoutId: row.loadoutId,
                metric: 'avgRedlineActions',
                baseline: row.summary.avgRedlineActions,
                candidate: candidateRow.summary.avgRedlineActions
            });
        }
        if (candidateRow.summary.avgSparkBurnDamage > row.summary.avgSparkBurnDamage) {
            regressions.push({
                loadoutId: row.loadoutId,
                metric: 'avgSparkBurnDamage',
                baseline: row.summary.avgSparkBurnDamage,
                candidate: candidateRow.summary.avgSparkBurnDamage
            });
        }
        if (candidateRow.redlineRunRate > row.redlineRunRate) {
            regressions.push({
                loadoutId: row.loadoutId,
                metric: 'redlineRunRate',
                baseline: row.redlineRunRate,
                candidate: candidateRow.redlineRunRate
            });
        }
    }

    for (const row of candidate.archetypes) {
        if (baselineMap.has(row.loadoutId)) continue;
        regressions.push({
            loadoutId: row.loadoutId,
            metric: 'unexpected_candidate',
            baseline: 'missing',
            candidate: row.loadoutId
        });
    }

    return {
        generatedAt: new Date().toISOString(),
        baseline: {
            generatedAt: baseline.generatedAt,
            params: baseline.params
        },
        candidate: {
            generatedAt: candidate.generatedAt,
            params: candidate.params
        },
        deltas,
        regressions,
        passed: regressions.length === 0
    };
};

export const writeIresStressGateReport = (file: string, report: IresStressGateReport): string => {
    const outPath = resolve(process.cwd(), file);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return outPath;
};

export const runIresStressGate = (
    baselineFile: string,
    candidateFile: string,
    outFile: string,
    strict = true
): IresStressGateReport => {
    const report = buildIresStressGateReport(
        loadIresStressArtifact(baselineFile),
        loadIresStressArtifact(candidateFile)
    );
    const outPath = writeIresStressGateReport(outFile, report);
    console.log(JSON.stringify({
        wrote: outPath,
        passed: report.passed,
        regressions: report.regressions.length
    }, null, 2));
    if (strict && !report.passed) {
        process.exitCode = 2;
    }
    return report;
};

const isDirectExecution = (): boolean => {
    const invokedPath = process.argv[1];
    if (!invokedPath) return false;
    return resolve(invokedPath) === resolve(fileURLToPath(import.meta.url));
};

if (isDirectExecution()) {
    const baselineFile = process.argv[2] || 'artifacts/ires/IRES_STRESS_BASELINE.json';
    const candidateFile = process.argv[3] || 'artifacts/ires/IRES_STRESS_CANDIDATE.json';
    const outFile = process.argv[4] || 'artifacts/ires/IRES_STRESS_GATE_REPORT.json';
    const strict = (process.argv[5] || '1') === '1';
    runIresStressGate(baselineFile, candidateFile, outFile, strict);
}
