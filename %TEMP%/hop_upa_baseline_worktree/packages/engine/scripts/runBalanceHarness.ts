import { runBatch, summarizeBatch } from '../src/systems/evaluation/balance-harness';
import type { ArchetypeLoadoutId } from '../src/systems/evaluation/balance-harness';
import { buildUpaEntitySnapshot } from './lib/upaEntitySnapshot';
import { getActiveTrinityProfileId } from '../src/systems/combat/trinity-profiles';

if (!process.env.HOP_TRINITY_PROFILE) {
    process.env.HOP_TRINITY_PROFILE = 'live';
}

const count = Number(process.argv[2] || 20);
const maxTurns = Number(process.argv[3] || 80);
const loadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const policyProfileId = process.argv[5] || 'sp-v1-default';
const seeds = Array.from({ length: count }, (_, i) => `balance-seed-${i + 1}`);

const randomResults = runBatch(seeds, 'random', maxTurns, loadoutId);
const heuristicResults = runBatch(seeds, 'heuristic', maxTurns, loadoutId, policyProfileId);

const randomSummary = summarizeBatch(randomResults, 'random', loadoutId);
const heuristicSummary = summarizeBatch(heuristicResults, 'heuristic', loadoutId);
const entitySnapshot = buildUpaEntitySnapshot(loadoutId);
const trinityProfile = getActiveTrinityProfileId();

console.log(JSON.stringify({ loadoutId, policyProfileId, trinityProfile, entitySnapshot, randomSummary, heuristicSummary }, null, 2));
