import type { MatchupRun, MatchupSummary, RunResult } from './harness-types';
import { summarizeCategoricalOutcomes } from './harness-core';

const resultRank = (result: RunResult['result']): number => {
    switch (result) {
        case 'won':
            return 3;
        case 'timeout':
            return 2;
        case 'lost':
        default:
            return 1;
    }
};

export const compareRuns = (left: RunResult, right: RunResult): 'left' | 'right' | 'tie' => {
    if (left.score !== right.score) return left.score > right.score ? 'left' : 'right';
    if (left.floor !== right.floor) return left.floor > right.floor ? 'left' : 'right';
    const leftRank = resultRank(left.result);
    const rightRank = resultRank(right.result);
    if (leftRank !== rightRank) return leftRank > rightRank ? 'left' : 'right';
    if (left.turnsSpent !== right.turnsSpent) return left.turnsSpent < right.turnsSpent ? 'left' : 'right';
    if (left.kills !== right.kills) return left.kills > right.kills ? 'left' : 'right';
    if (left.hazardBreaches !== right.hazardBreaches) return left.hazardBreaches < right.hazardBreaches ? 'left' : 'right';
    return 'tie';
};

export const summarizeMatchup = (runs: MatchupRun[]): MatchupSummary => {
    const outcomeSummary = summarizeCategoricalOutcomes(
        runs.map(r => r.winner),
        ['left', 'right', 'tie'] as const
    );
    const games = outcomeSummary.total;
    const leftWins = outcomeSummary.counts.left;
    const rightWins = outcomeSummary.counts.right;
    const ties = outcomeSummary.counts.tie;
    return {
        games,
        leftWins,
        rightWins,
        ties,
        leftWinRate: outcomeSummary.rates.left,
        rightWinRate: outcomeSummary.rates.right,
        tieRate: outcomeSummary.rates.tie
    };
};
