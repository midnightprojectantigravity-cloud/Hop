import type { BatchSummary } from './evaluation/balance-harness';

export interface UpaTelemetryInput {
    winRate: number;
    avgTurnsToWin: number;
    timeoutRate: number;
    avgFloor: number;
    avgHazardBreaches: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const computeUPA = (input: UpaTelemetryInput): number => {
    const winComponent = clamp01(input.winRate);
    // No wins means no reliable "pace-to-win" signal.
    const paceComponent = winComponent > 0 ? clamp01(1 - (input.avgTurnsToWin / 80)) : 0;
    const progressComponent = clamp01(input.avgFloor / 10);
    const safetyComponent = clamp01(1 - (input.avgHazardBreaches / 10));
    const timeoutPenalty = clamp01(input.timeoutRate);
    // Telemetry-only composite score, not used in gameplay branches.
    const base = (0.4 * winComponent) + (0.2 * paceComponent) + (0.2 * progressComponent) + (0.2 * safetyComponent);
    const penalized = clamp01(base - (0.25 * timeoutPenalty));
    return Number(penalized.toFixed(4));
};

export const computeUPAFromSummary = (summary: BatchSummary): number => {
    return computeUPA({
        winRate: summary.winRate,
        avgTurnsToWin: summary.avgTurnsToWin,
        timeoutRate: summary.timeoutRate,
        avgFloor: summary.avgFloor,
        avgHazardBreaches: summary.avgHazardBreaches
    });
};
