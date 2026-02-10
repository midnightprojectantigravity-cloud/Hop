import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { runBatch, summarizeBatch, type ArchetypeLoadoutId } from '../src/systems/balance-harness';
import { computeUPAFromSummary } from '../src/systems/upa';
import { COMBAT_PROFILE_SET_VERSION } from '../src/systems/combat-traits';
import { TRINITY_PROFILE_SET_VERSION, getActiveTrinityProfileId } from '../src/systems/trinity-profiles';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

type SeedPayload = {
    version: string;
    seeds: string[];
};

const args = process.argv.slice(2);
const seedsFile = args[0] || 'docs/MVP_SEEDS_mvp-v1.json';
const maxTurns = Number(args[1] || 80);
const policy = (args[2] || 'heuristic') as 'heuristic' | 'random';
const outFile = args[3] || 'docs/MVP_BASELINE_mvp-v1.json';

const seedsPath = resolve(process.cwd(), seedsFile);
const outPath = resolve(process.cwd(), outFile);
const seedsJson = JSON.parse(readFileSync(seedsPath, 'utf8')) as SeedPayload;
const seeds = Array.isArray(seedsJson.seeds) ? seedsJson.seeds : [];

if (seeds.length === 0) {
    throw new Error(`No seeds found in ${seedsPath}`);
}

const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];
const archetypes = loadouts.map(loadoutId => {
    const runSeeds = seeds.map((seed, i) => `${seed}:${loadoutId}:${i + 1}`);
    const runs = runBatch(runSeeds, policy, maxTurns, loadoutId);
    const summary = summarizeBatch(runs, policy, loadoutId);
    return {
        loadoutId,
        summary: {
            winRate: summary.winRate,
            timeoutRate: summary.timeoutRate,
            avgFloor: summary.avgFloor,
            avgTurnsToWin: summary.avgTurnsToWin,
            avgHazardBreaches: summary.avgHazardBreaches,
            avgFinalPlayerHpRatio: summary.avgFinalPlayerHpRatio,
            reachedFloor3Rate: summary.reachedFloor3Rate,
            reachedFloor5Rate: summary.reachedFloor5Rate,
            upa: computeUPAFromSummary(summary),
            trinityContribution: summary.trinityContribution,
            combatProfileSignal: summary.combatProfileSignal
        }
    };
});

const payload = {
    generatedAt: new Date().toISOString(),
    mvpVersion: 'mvp-v1',
    policy,
    maxTurns,
    seedsVersion: seedsJson.version || 'unknown',
    seedCount: seeds.length,
    trinityProfileSetVersion: TRINITY_PROFILE_SET_VERSION,
    combatProfileSetVersion: COMBAT_PROFILE_SET_VERSION,
    activeTrinityProfile: getActiveTrinityProfileId(),
    archetypes
};

writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
originalLog(JSON.stringify({
    wrote: outPath,
    mvpVersion: payload.mvpVersion,
    archetypes: archetypes.length,
    seedCount: seeds.length
}, null, 2));
