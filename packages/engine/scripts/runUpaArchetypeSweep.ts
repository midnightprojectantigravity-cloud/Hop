import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runBatch, summarizeBatch, type ArchetypeLoadoutId, type BotPolicy } from '../src/systems/evaluation/balance-harness';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { computeUPAFromSummary } from '../src/systems/upa';
import { getActiveTrinityProfileId } from '../src/systems/combat/trinity-profiles';

const count = Number(process.argv[2] || 300);
const maxTurns = Number(process.argv[3] || 80);
const policy = (process.argv[4] || 'heuristic') as BotPolicy;
const policyProfileId = process.argv[5] || 'sp-v1-balance';
const outFile = process.argv[6] || 'artifacts/upa/UPA_TUNING_SWEEP.json';
const seedPrefix = process.argv[7] || `upa-tuning-${policyProfileId}`;

if (!process.env.HOP_TRINITY_PROFILE) {
    process.env.HOP_TRINITY_PROFILE = 'live';
}

const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];

const archetypes = loadouts.map(loadoutId => {
    const seeds = Array.from({ length: count }, (_, i) => `${seedPrefix}-${loadoutId}-${i + 1}`);
    const runs = runBatch(seeds, policy, maxTurns, loadoutId, policyProfileId);
    const summary = summarizeBatch(runs, policy, loadoutId);
    return {
        loadoutId,
        upa: computeUPAFromSummary(summary),
        summary: {
            winRate: summary.winRate,
            timeoutRate: summary.timeoutRate,
            avgFloor: summary.avgFloor,
            avgHazardBreaches: summary.avgHazardBreaches,
            avgTurnsToWin: summary.avgTurnsToWin,
            avgTurnsToLoss: summary.avgTurnsToLoss,
            avgFinalPlayerHpRatio: summary.avgFinalPlayerHpRatio,
            avgPlayerSkillCastsPerRun: summary.avgPlayerSkillCastsPerRun,
        },
    };
});

const weakest = [...archetypes].sort((a, b) => a.summary.avgFloor - b.summary.avgFloor)[0];
const strongest = [...archetypes].sort((a, b) => b.summary.avgFloor - a.summary.avgFloor)[0];

const payload = {
    generatedAt: new Date().toISOString(),
    params: {
        count,
        maxTurns,
        policy,
        policyProfileId,
        seedPrefix,
        trinityProfile: getActiveTrinityProfileId(),
    },
    aggregates: {
        avgFloorMean: archetypes.reduce((sum, row) => sum + row.summary.avgFloor, 0) / Math.max(1, archetypes.length),
        avgWinRateMean: archetypes.reduce((sum, row) => sum + row.summary.winRate, 0) / Math.max(1, archetypes.length),
        avgTimeoutRateMean: archetypes.reduce((sum, row) => sum + row.summary.timeoutRate, 0) / Math.max(1, archetypes.length),
        weakestAvgFloor: weakest?.summary.avgFloor ?? 0,
        weakestLoadoutId: weakest?.loadoutId ?? null,
        strongestAvgFloor: strongest?.summary.avgFloor ?? 0,
        strongestLoadoutId: strongest?.loadoutId ?? null,
    },
    archetypes,
};

const outPath = resolve(process.cwd(), outFile);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
    wrote: outPath,
    archetypes: archetypes.length,
    weakestLoadoutId: payload.aggregates.weakestLoadoutId,
    weakestAvgFloor: Number(payload.aggregates.weakestAvgFloor.toFixed(4)),
}, null, 2));
