import type { PvpRunResult, PvpSummary } from './pvp-harness';
import {
    average,
    averageHistogramPerEntry,
    mergeHistogram,
    summarizeCategoricalOutcomes,
} from './harness-core';

export const summarizePvpBatch = (runs: PvpRunResult[]): PvpSummary => {
    const outcomeSummary = summarizeCategoricalOutcomes(
        runs.map(r => r.winner),
        ['left', 'right', 'draw'] as const
    );
    const games = outcomeSummary.total;
    const leftWins = outcomeSummary.counts.left;
    const rightWins = outcomeSummary.counts.right;
    const draws = outcomeSummary.counts.draw;

    const leftActionTotals: Record<string, number> = {};
    const rightActionTotals: Record<string, number> = {};
    const leftSkillUsageTotals: Record<string, number> = {};
    const rightSkillUsageTotals: Record<string, number> = {};
    for (const run of runs) {
        mergeHistogram(leftActionTotals, run.leftActionCounts);
        mergeHistogram(rightActionTotals, run.rightActionCounts);
        mergeHistogram(leftSkillUsageTotals, run.leftSkillUsage);
        mergeHistogram(rightSkillUsageTotals, run.rightSkillUsage);
    }
    const leftAvgSkillUsagePerRun = averageHistogramPerEntry(leftSkillUsageTotals, games);
    const rightAvgSkillUsagePerRun = averageHistogramPerEntry(rightSkillUsageTotals, games);

    return {
        games,
        leftWins,
        rightWins,
        draws,
        leftWinRate: outcomeSummary.rates.left,
        rightWinRate: outcomeSummary.rates.right,
        drawRate: outcomeSummary.rates.draw,
        avgRounds: average(runs.map(r => r.roundsPlayed)),
        leftAvgRemainingHp: average(runs.map(r => r.leftHp)),
        rightAvgRemainingHp: average(runs.map(r => r.rightHp)),
        leftActionTotals,
        rightActionTotals,
        leftSkillUsageTotals,
        rightSkillUsageTotals,
        leftAvgSkillUsagePerRun,
        rightAvgSkillUsagePerRun
    };
};
