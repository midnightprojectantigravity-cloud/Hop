import {
    runBatch,
    summarizeBatch,
    type ArchetypeLoadoutId,
    type BotPolicy,
    type BatchSummary
} from '../src/systems/evaluation/balance-harness';

type DriftMetricKey =
    | 'winRate'
    | 'timeoutRate'
    | 'avgFloor'
    | 'avgTurnsToLoss'
    | 'avgFinalPlayerHpRatio';

interface DriftMetricComparison {
    metric: DriftMetricKey;
    baseline: number;
    dynamicBias: number;
    delta: number;
    absDelta: number;
    tolerance: number;
    withinTolerance: boolean;
}

interface DriftLoadoutReport {
    loadoutId: ArchetypeLoadoutId;
    policy: BotPolicy;
    policyProfileId: string;
    seedCount: number;
    maxTurns: number;
    baseline: Pick<BatchSummary, DriftMetricKey>;
    dynamicBias: Pick<BatchSummary, DriftMetricKey>;
    comparisons: DriftMetricComparison[];
    pass: boolean;
}

interface DriftReport {
    generatedAt: string;
    config: {
        seedCount: number;
        maxTurns: number;
        policy: BotPolicy;
        policyProfileId: string;
        loadouts: ArchetypeLoadoutId[];
        dynamicBiasStrength: number;
        bomberBombWindowBonus: number;
        bomberRepositionBonus: number;
    };
    tolerances: Record<DriftMetricKey, number>;
    reports: DriftLoadoutReport[];
    overallPass: boolean;
}

const DRIFT_TOLERANCES: Record<DriftMetricKey, number> = {
    winRate: 0.02,
    timeoutRate: 0.02,
    avgFloor: 0.25,
    avgTurnsToLoss: 2,
    avgFinalPlayerHpRatio: 0.05
};

const toEnvKeySuffix = (name: string): string => name.replace(/-/g, '_').toUpperCase();
const positionalArgs = process.argv.slice(2).filter(v => !v.startsWith('--') && v !== 'true');
const positionByName: Partial<Record<string, number>> = {
    'bias-strength': 0,
    'seeds': 1,
    'max-turns': 2,
    'bomber-bomb-bonus': 3,
    'bomber-reposition-bonus': 4
};

const parseArg = (name: string): string | undefined => {
    const eqPrefix = `--${name}=`;
    const eqArg = process.argv.find(v => v.startsWith(eqPrefix));
    if (eqArg) return eqArg.slice(eqPrefix.length);

    const index = process.argv.indexOf(`--${name}`);
    if (index >= 0) {
        const next = process.argv[index + 1];
        if (next && !next.startsWith('--')) return next;
    }

    const directEnv = process.env[`HOP_AI_DRIFT_${toEnvKeySuffix(name)}`];
    if (directEnv !== undefined && directEnv !== '') return directEnv;

    const npmConfigEnv = process.env[`npm_config_${name.replace(/-/g, '_')}`];
    if (npmConfigEnv !== undefined && npmConfigEnv !== '' && npmConfigEnv !== 'true') return npmConfigEnv;

    const positionalIndex = positionByName[name];
    if (positionalIndex !== undefined) {
        const positional = positionalArgs[positionalIndex];
        if (positional) return positional;
    }

    return undefined;
};

const parseIntArg = (name: string, defaultValue: number, min: number): number => {
    const raw = parseArg(name);
    if (!raw) return defaultValue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) {
        throw new Error(`Invalid value for ${name}: ${raw}`);
    }
    return parsed;
};

const parseFloatArg = (name: string, defaultValue: number, min: number, max: number): number => {
    const raw = parseArg(name);
    if (!raw) return defaultValue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        throw new Error(`Invalid value for ${name}: ${raw}`);
    }
    return parsed;
};

const parsePolicy = (raw?: string): BotPolicy => {
    if (!raw) return 'heuristic';
    if (raw === 'heuristic' || raw === 'random') return raw;
    throw new Error(`Invalid --policy value: ${raw}`);
};

const parseLoadouts = (raw?: string): ArchetypeLoadoutId[] => {
    const defaults: ArchetypeLoadoutId[] = ['VANGUARD', 'NECROMANCER'];
    if (!raw) return defaults;
    const parsed = raw
        .split(/[,\s]+/)
        .map(v => v.trim())
        .filter(Boolean) as ArchetypeLoadoutId[];
    if (parsed.length === 0) return defaults;
    return parsed;
};

const buildSeeds = (loadoutId: ArchetypeLoadoutId, count: number): string[] =>
    Array.from({ length: count }, (_, i) => `intent-bias-${loadoutId}-${i}`);

const withDynamicIntentBias = (
    enabled: boolean,
    biasStrength: number | undefined,
    calibration: { bomberBombWindowBonus: number; bomberRepositionBonus: number },
    fn: () => any
) => {
    const key = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS';
    const strengthKey = 'HOP_ENEMY_AI_DYNAMIC_INTENT_BIAS_STRENGTH';
    const bombWindowKey = 'HOP_ENEMY_AI_BOMBER_BOMB_WINDOW_BONUS';
    const repositionKey = 'HOP_ENEMY_AI_BOMBER_REPOSITION_BONUS';
    const previous = process.env[key];
    const previousStrength = process.env[strengthKey];
    const previousBombWindow = process.env[bombWindowKey];
    const previousReposition = process.env[repositionKey];
    if (enabled) {
        process.env[key] = '1';
        if (biasStrength !== undefined) {
            process.env[strengthKey] = String(biasStrength);
        } else {
            delete process.env[strengthKey];
        }
        process.env[bombWindowKey] = String(calibration.bomberBombWindowBonus);
        process.env[repositionKey] = String(calibration.bomberRepositionBonus);
    } else {
        delete process.env[key];
        delete process.env[strengthKey];
        delete process.env[bombWindowKey];
        delete process.env[repositionKey];
    }
    try {
        return fn();
    } finally {
        if (previous === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = previous;
        }
        if (previousStrength === undefined) {
            delete process.env[strengthKey];
        } else {
            process.env[strengthKey] = previousStrength;
        }
        if (previousBombWindow === undefined) {
            delete process.env[bombWindowKey];
        } else {
            process.env[bombWindowKey] = previousBombWindow;
        }
        if (previousReposition === undefined) {
            delete process.env[repositionKey];
        } else {
            process.env[repositionKey] = previousReposition;
        }
    }
};

const extractMetrics = (summary: BatchSummary): Pick<BatchSummary, DriftMetricKey> => ({
    winRate: summary.winRate,
    timeoutRate: summary.timeoutRate,
    avgFloor: summary.avgFloor,
    avgTurnsToLoss: summary.avgTurnsToLoss,
    avgFinalPlayerHpRatio: summary.avgFinalPlayerHpRatio
});

const compareMetrics = (
    baseline: Pick<BatchSummary, DriftMetricKey>,
    dynamicBias: Pick<BatchSummary, DriftMetricKey>
): DriftMetricComparison[] => {
    const keys = Object.keys(DRIFT_TOLERANCES) as DriftMetricKey[];
    return keys.map(metric => {
        const base = Number(baseline[metric] || 0);
        const dyn = Number(dynamicBias[metric] || 0);
        const delta = dyn - base;
        const absDelta = Math.abs(delta);
        const tolerance = DRIFT_TOLERANCES[metric];
        return {
            metric,
            baseline: base,
            dynamicBias: dyn,
            delta,
            absDelta,
            tolerance,
            withinTolerance: absDelta <= tolerance
        };
    });
};

const main = (): void => {
    const seedCount = parseIntArg('seeds', 12, 1);
    const maxTurns = parseIntArg('max-turns', 80, 1);
    const dynamicBiasStrength = parseFloatArg('bias-strength', 1, 0, 8);
    const bomberBombWindowBonus = parseFloatArg('bomber-bomb-bonus', 0, -50, 50);
    const bomberRepositionBonus = parseFloatArg('bomber-reposition-bonus', 0, -50, 50);
    const policy = parsePolicy(parseArg('policy'));
    const policyProfileId = parseArg('policy-profile') || 'sp-v1-default';
    const loadouts = parseLoadouts(parseArg('loadouts'));
    const calibration = {
        bomberBombWindowBonus,
        bomberRepositionBonus
    };

    const reports: DriftLoadoutReport[] = loadouts.map(loadoutId => {
        const seeds = buildSeeds(loadoutId, seedCount);

        const baselineSummary = withDynamicIntentBias(false, undefined, calibration, () =>
            summarizeBatch(runBatch(seeds, policy, maxTurns, loadoutId, policyProfileId), policy, loadoutId)
        );
        const dynamicSummary = withDynamicIntentBias(true, dynamicBiasStrength, calibration, () =>
            summarizeBatch(runBatch(seeds, policy, maxTurns, loadoutId, policyProfileId), policy, loadoutId)
        );

        const baseline = extractMetrics(baselineSummary);
        const dynamicBias = extractMetrics(dynamicSummary);
        const comparisons = compareMetrics(baseline, dynamicBias);
        const pass = comparisons.every(c => c.withinTolerance);

        return {
            loadoutId,
            policy,
            policyProfileId,
            seedCount,
            maxTurns,
            baseline,
            dynamicBias,
            comparisons,
            pass
        };
    });

    const report: DriftReport = {
        generatedAt: new Date().toISOString(),
        config: {
            seedCount,
            maxTurns,
            policy,
            policyProfileId,
            loadouts,
            dynamicBiasStrength,
            bomberBombWindowBonus,
            bomberRepositionBonus
        },
        tolerances: DRIFT_TOLERANCES,
        reports,
        overallPass: reports.every(r => r.pass)
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.overallPass) {
        process.exit(2);
    }
};

main();
