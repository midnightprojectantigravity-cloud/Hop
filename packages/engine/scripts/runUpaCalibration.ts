import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBatch, summarizeBatch, type ArchetypeLoadoutId } from '../src/systems/balance-harness';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { computeUPAFromSummary } from '../src/systems/upa';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

type Guardrails = {
    timeoutRateMax: number;
    avgFloorMin: number;
    avgHazardBreachesMax: number;
};

const count = Number(process.argv[2] || 300);
const maxTurns = Number(process.argv[3] || 80);
const policy = (process.argv[4] || 'heuristic') as 'heuristic' | 'random';
const outFile = process.argv[5] || 'docs/UPA_CALIBRATION_BASELINE.json';
const waiverArg = process.argv[6] || '';
const strict = (process.argv[7] || '0') === '1';
const waiverLoadouts = new Set(
    waiverArg
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
);

const guardrails: Guardrails = {
    timeoutRateMax: 0.95,
    avgFloorMin: 1.2,
    avgHazardBreachesMax: 1.0
};

const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];

const results = loadouts.map(loadoutId => {
    const seeds = Array.from({ length: count }, (_, i) => `calibration-${loadoutId}-${i + 1}`);
    const runs = runBatch(seeds, policy, maxTurns, loadoutId);
    const summary = summarizeBatch(runs, policy, loadoutId);
    const avgKills = runs.reduce((acc, run) => acc + (run.kills || 0), 0) / Math.max(1, runs.length);
    const breached: string[] = [];
    if (summary.timeoutRate > guardrails.timeoutRateMax) breached.push('timeoutRate');
    if (summary.avgFloor < guardrails.avgFloorMin) breached.push('avgFloor');
    if (summary.avgHazardBreaches > guardrails.avgHazardBreachesMax) breached.push('avgHazardBreaches');
    const waived = waiverLoadouts.has(loadoutId);

    return {
        loadoutId,
        summary: {
            winRate: summary.winRate,
            timeoutRate: summary.timeoutRate,
            avgFloor: summary.avgFloor,
            avgHazardBreaches: summary.avgHazardBreaches,
            avgKills,
            upa: computeUPAFromSummary(summary)
        },
        guardrails,
        breaches: breached,
        waived,
        waiverNote: waived && breached.length > 0
            ? `Waived metrics for ${loadoutId}: ${breached.join(', ')}`
            : null
    };
});

const unwaivedBreaches = results.filter(r => r.breaches.length > 0 && !r.waived);
const payload = {
    generatedAt: new Date().toISOString(),
    policy,
    count,
    maxTurns,
    guardrails,
    waiverLoadouts: [...waiverLoadouts],
    archetypes: results,
    unwaivedBreachCount: unwaivedBreaches.length
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
originalLog(JSON.stringify({
    wrote: target,
    archetypes: results.length,
    unwaivedBreachCount: unwaivedBreaches.length
}, null, 2));

if (strict && unwaivedBreaches.length > 0) {
    process.exitCode = 2;
}
