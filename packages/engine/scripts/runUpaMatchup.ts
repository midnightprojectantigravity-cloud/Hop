import {
    runBatch,
    runHeadToHeadBatch,
    summarizeBatch,
    summarizeMatchup,
    type ArchetypeLoadoutId,
    type BotPolicy,
    type RunResult,
} from '../src/systems/balance-harness';
import { computeUPAFromSummary } from '../src/systems/upa';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const count = Number(process.argv[2] || 200);
const maxTurns = Number(process.argv[3] || 80);
const leftLoadout = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const rightLoadout = (process.argv[5] || 'FIREMAGE') as ArchetypeLoadoutId;
const leftPolicy = (process.argv[6] || 'heuristic') as BotPolicy;
const rightPolicy = (process.argv[7] || 'heuristic') as BotPolicy;

const seeds = Array.from({ length: count }, (_, i) => `upa-matchup-${i + 1}`);

const leftRuns = runBatch(seeds, leftPolicy, maxTurns, leftLoadout);
const rightRuns = runBatch(seeds, rightPolicy, maxTurns, rightLoadout);
const matchupRuns = runHeadToHeadBatch(
    seeds,
    { policy: leftPolicy, loadoutId: leftLoadout },
    { policy: rightPolicy, loadoutId: rightLoadout },
    maxTurns
);

const leftSummary = summarizeBatch(leftRuns, leftPolicy, leftLoadout);
const rightSummary = summarizeBatch(rightRuns, rightPolicy, rightLoadout);
const matchupSummary = summarizeMatchup(matchupRuns);

const topByMargin = (runs: RunResult[], n: number) =>
    [...runs]
        .sort((a, b) => b.score - a.score)
        .slice(0, n)
        .map(r => ({ seed: r.seed, score: r.score, result: r.result, floor: r.floor, turnsSpent: r.turnsSpent }));

originalLog(
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            count,
            maxTurns,
            left: {
                loadoutId: leftLoadout,
                policy: leftPolicy,
                summary: leftSummary,
                upa: computeUPAFromSummary(leftSummary),
                strongest: topByMargin(leftRuns, 5)
            },
            right: {
                loadoutId: rightLoadout,
                policy: rightPolicy,
                summary: rightSummary,
                upa: computeUPAFromSummary(rightSummary),
                strongest: topByMargin(rightRuns, 5)
            },
            matchup: {
                summary: matchupSummary,
                sample: matchupRuns.slice(0, 10).map(r => ({
                    seed: r.seed,
                    winner: r.winner,
                    leftScore: r.left.score,
                    rightScore: r.right.score,
                    leftResult: r.left.result,
                    rightResult: r.right.result
                }))
            }
        },
        null,
        2
    )
);
