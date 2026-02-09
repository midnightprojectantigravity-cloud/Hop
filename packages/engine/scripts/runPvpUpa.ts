import type { ArchetypeLoadoutId, BotPolicy } from '../src/systems/balance-harness';
import { runPvpBatch, summarizePvpBatch } from '../src/systems/pvp-harness';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const computePvpUpa = (winRate: number, drawRate: number, avgRounds: number, maxRounds: number): number => {
    const decisiveRate = clamp01(1 - drawRate);
    const pace = clamp01(1 - (avgRounds / Math.max(1, maxRounds)));
    const value = (0.75 * clamp01(winRate)) + (0.15 * decisiveRate) + (0.10 * pace);
    return Number(clamp01(value).toFixed(4));
};

const count = Number(process.argv[2] || 200);
const maxRounds = Number(process.argv[3] || 60);
const leftLoadoutId = (process.argv[4] || 'VANGUARD') as ArchetypeLoadoutId;
const rightLoadoutId = (process.argv[5] || 'HUNTER') as ArchetypeLoadoutId;
const leftPolicy = (process.argv[6] || 'heuristic') as BotPolicy;
const rightPolicy = (process.argv[7] || 'heuristic') as BotPolicy;

const seeds = Array.from({ length: count }, (_, i) => `pvp-upa-seed-${i + 1}`);
const runs = runPvpBatch(
    seeds,
    leftLoadoutId,
    rightLoadoutId,
    leftPolicy,
    rightPolicy,
    maxRounds
);
const summary = summarizePvpBatch(runs);

const sample = runs.slice(0, 12).map(r => ({
    seed: r.seed,
    winner: r.winner,
    roundsPlayed: r.roundsPlayed,
    leftHp: r.leftHp,
    rightHp: r.rightHp
}));

originalLog(JSON.stringify({
    generatedAt: new Date().toISOString(),
    count,
    maxRounds,
    left: {
        loadoutId: leftLoadoutId,
        policy: leftPolicy,
        pvpUpa: computePvpUpa(summary.leftWinRate, summary.drawRate, summary.avgRounds, maxRounds)
    },
    right: {
        loadoutId: rightLoadoutId,
        policy: rightPolicy,
        pvpUpa: computePvpUpa(summary.rightWinRate, summary.drawRate, summary.avgRounds, maxRounds)
    },
    summary,
    sample
}, null, 2));

