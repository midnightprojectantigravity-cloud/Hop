import { runBatch, summarizeBatch, type BotPolicy, type RunResult, type ArchetypeLoadoutId } from '../src/systems/balance-harness';
import { computeUPAFromSummary } from '../src/systems/upa';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const count = Number(process.argv[2] || 1000);
const maxTurns = Number(process.argv[3] || 80);
const loadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const seeds = Array.from({ length: count }, (_, i) => `upa-seed-${i + 1}`);
const policies: BotPolicy[] = ['random', 'heuristic'];

const topN = (results: RunResult[], n: number) =>
    [...results]
        .sort((a, b) => b.score - a.score)
        .slice(0, n)
        .map(r => ({ seed: r.seed, score: r.score, result: r.result, turnsSpent: r.turnsSpent }));

const bottomN = (results: RunResult[], n: number) =>
    [...results]
        .sort((a, b) => a.score - b.score)
        .slice(0, n)
        .map(r => ({ seed: r.seed, score: r.score, result: r.result, turnsSpent: r.turnsSpent }));

const report = policies.map(policy => {
    const results = runBatch(seeds, policy, maxTurns, loadoutId);
    const summary = summarizeBatch(results, policy, loadoutId);
    const upa = computeUPAFromSummary(summary);
    const resultCounts = results.reduce<Record<string, number>>((acc, run) => {
        acc[run.result] = (acc[run.result] || 0) + 1;
        return acc;
    }, {});
    return {
        policy,
        loadoutId,
        games: results.length,
        resultCounts,
        summary,
        upa,
        outliers: {
            strongest: topN(results, 5),
            weakest: bottomN(results, 5)
        }
    };
});

originalLog(JSON.stringify({ count, maxTurns, loadoutId, generatedAt: new Date().toISOString(), report }, null, 2));
