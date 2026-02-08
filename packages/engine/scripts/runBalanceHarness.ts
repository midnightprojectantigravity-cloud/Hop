import { runBatch, summarizeBatch } from '../src/systems/balance-harness';
import type { ArchetypeLoadoutId } from '../src/systems/balance-harness';

const count = Number(process.argv[2] || 20);
const maxTurns = Number(process.argv[3] || 80);
const loadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const seeds = Array.from({ length: count }, (_, i) => `balance-seed-${i + 1}`);

const randomResults = runBatch(seeds, 'random', maxTurns, loadoutId);
const heuristicResults = runBatch(seeds, 'heuristic', maxTurns, loadoutId);

const randomSummary = summarizeBatch(randomResults, 'random', loadoutId);
const heuristicSummary = summarizeBatch(heuristicResults, 'heuristic', loadoutId);

console.log(JSON.stringify({ loadoutId, randomSummary, heuristicSummary }, null, 2));
