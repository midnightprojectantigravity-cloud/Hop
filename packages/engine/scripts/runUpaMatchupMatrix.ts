import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_LOADOUTS } from '../src/systems/loadout';
import { runHeadToHeadBatch, summarizeMatchup, type ArchetypeLoadoutId } from '../src/systems/balance-harness';

const originalLog = console.log.bind(console);
if (process.env.VERBOSE_ANALYSIS !== '1') {
    console.log = () => undefined;
    console.warn = () => undefined;
}

type MatchupCell = {
    left: ArchetypeLoadoutId;
    right: ArchetypeLoadoutId;
    games: number;
    leftWinRate: number;
    rightWinRate: number;
    tieRate: number;
    dominanceDelta: number;
};

const count = Number(process.argv[2] || 200);
const maxTurns = Number(process.argv[3] || 80);
const outFile = process.argv[4] || 'docs/UPA_PVP_MATCHUP_MATRIX.json';
const policy = (process.argv[5] || 'heuristic') as 'heuristic' | 'random';

const loadouts = Object.keys(DEFAULT_LOADOUTS) as ArchetypeLoadoutId[];
const cells: MatchupCell[] = [];

for (const left of loadouts) {
    for (const right of loadouts) {
        if (left === right) continue;
        const seeds = Array.from({ length: count }, (_, i) => `matrix-${left}-vs-${right}-${i + 1}`);
        const runs = runHeadToHeadBatch(
            seeds,
            { policy, loadoutId: left },
            { policy, loadoutId: right },
            maxTurns
        );
        const summary = summarizeMatchup(runs);
        cells.push({
            left,
            right,
            games: summary.games,
            leftWinRate: summary.leftWinRate,
            rightWinRate: summary.rightWinRate,
            tieRate: summary.tieRate,
            dominanceDelta: Number(Math.abs(summary.leftWinRate - summary.rightWinRate).toFixed(4))
        });
    }
}

const imbalanceCandidates = [...cells]
    .sort((a, b) => b.dominanceDelta - a.dominanceDelta)
    .slice(0, 3)
    .map(cell => ({
        pairing: `${cell.left} vs ${cell.right}`,
        dominanceDelta: cell.dominanceDelta,
        leftWinRate: cell.leftWinRate,
        rightWinRate: cell.rightWinRate,
        recommendation: `Review ${cell.left} and ${cell.right} skill coefficients/heuristic target priorities`
    }));

const payload = {
    generatedAt: new Date().toISOString(),
    policy,
    count,
    maxTurns,
    loadouts,
    matrix: cells,
    imbalanceCandidates
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
originalLog(JSON.stringify({
    wrote: target,
    matchups: cells.length,
    imbalanceCandidates: imbalanceCandidates.length
}, null, 2));
