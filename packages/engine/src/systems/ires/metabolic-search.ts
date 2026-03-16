import { buildIresMetabolicAnalysisReport } from '../evaluation/ires-metabolic-analysis';
import { cloneIresMetabolicConfig, DEFAULT_IRES_METABOLIC_CONFIG } from './metabolic-config';
import type { IresMetabolicConfig, MetabolicAnalysisReport, MetabolicSearchCandidate } from './metabolic-types';

const buildCandidate = (
    id: string,
    label: string,
    mutate: (config: IresMetabolicConfig) => void
): MetabolicSearchCandidate => {
    const next = cloneIresMetabolicConfig(DEFAULT_IRES_METABOLIC_CONFIG);
    mutate(next);
    const report = buildIresMetabolicAnalysisReport(next);
    const totalScore = Number(report.targetOutcomes.reduce((sum, outcome) => sum + outcome.score, 0).toFixed(3));
    return {
        id,
        label,
        totalScore,
        config: next,
        targetOutcomes: report.targetOutcomes
    };
};

export const runIresMetabolicSearch = (): {
    generatedAt: string;
    baselineScore: number;
    candidates: MetabolicSearchCandidate[];
    bestCandidate: MetabolicSearchCandidate;
    baselineReport: MetabolicAnalysisReport;
} => {
    const baselineReport = buildIresMetabolicAnalysisReport(DEFAULT_IRES_METABOLIC_CONFIG);
    const baselineScore = Number(baselineReport.targetOutcomes.reduce((sum, outcome) => sum + outcome.score, 0).toFixed(3));

    const candidates: MetabolicSearchCandidate[] = [
        buildCandidate('base_bfi_down', 'Lower BFI Anchor', (config) => {
            config.baseBfiFormula.base = 9;
        }),
        buildCandidate('instinct_scale_up', 'Stronger Instinct Scaling', (config) => {
            config.baseBfiFormula.instinctScale = -0.12;
        }),
        buildCandidate('maintenance_band_down', 'Cheaper Maintenance Band', (config) => {
            config.actionBands.maintenance.sparkCost = 8;
            config.actionBands.maintenance.baseExhaustion = 0;
        }),
        buildCandidate('standard_band_down', 'Softer Standard Band', (config) => {
            config.actionBands.standard.sparkCost = 22;
            config.actionBands.standard.manaCost = 7;
            config.actionBands.standard.baseExhaustion = 10;
        }),
        buildCandidate('spark_recovery_up', 'Higher Passive Spark Recovery', (config) => {
            config.sparkRecoveryFormula.base = 22;
        }),
        buildCandidate('wait_bonus_up', 'Larger Wait Bonus', (config) => {
            config.waitSparkBonus = 35;
            config.waitExhaustionBonus = 45;
        }),
        buildCandidate('base_bleed_up', 'Stronger Passive Base Bleed', (config) => {
            config.exhaustionBleedByState.base.base = 18;
        }),
        buildCandidate('heavy_bfi_down', 'Softer Heavy BFI', (config) => {
            config.weightBfiAdjustments.Heavy = 0;
        }),
        buildCandidate('heavy_move_down', 'Softer Heavy Move Cost', (config) => {
            config.weightMovementSparkAdjustments.Heavy = 10;
        }),
        buildCandidate('travel_relief_up', 'Stronger Travel Relief', (config) => {
            config.travelMode.sparkRecovery = 30;
            config.travelMode.exhaustionClear = 30;
        })
    ].sort((left, right) => left.totalScore - right.totalScore);

    return {
        generatedAt: new Date().toISOString(),
        baselineScore,
        candidates,
        bestCandidate: candidates[0]!,
        baselineReport
    };
};
