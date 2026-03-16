import { cloneIresMetabolicConfig, DEFAULT_IRES_METABOLIC_CONFIG } from '../ires/metabolic-config';
import { simulateMetabolicWorkload } from '../ires/metabolic-simulator';
import { buildDefaultMetabolicProfileMatrix, scoreMetabolicTargets } from '../ires/metabolic-targets';
import type {
    IresMetabolicConfig,
    MetabolicAnalysisReport,
    MetabolicCadenceResult,
    MetabolicSensitivityResult
} from '../ires/metabolic-types';

const findResult = (
    results: MetabolicCadenceResult[],
    profileId: string,
    workloadId: string
): MetabolicCadenceResult | undefined =>
    results.find((entry) => entry.profileId === profileId && entry.workloadId === workloadId);

export const buildIresMetabolicAnalysisReport = (
    config: IresMetabolicConfig = DEFAULT_IRES_METABOLIC_CONFIG
): MetabolicAnalysisReport => {
    const profileMatrix = buildDefaultMetabolicProfileMatrix();
    const workloads = Object.values(config.workloadCatalog);
    const results = profileMatrix.flatMap((profile) =>
        workloads.map((workload) => simulateMetabolicWorkload({ config, profile, workload }))
    );
    const targetOutcomes = scoreMetabolicTargets(results);

    const moveX1 = findResult(results, 'balanced_mid_standard', 'basic_move_x1');
    const moveX2 = findResult(results, 'balanced_mid_standard', 'basic_move_x2');
    const moveX3 = findResult(results, 'balanced_mid_standard', 'basic_move_x3');
    const bodyMoveX2 = findResult(results, 'body_mid_standard', 'basic_move_x2');
    const instinctMoveX2 = findResult(results, 'instinct_mid_standard', 'basic_move_x2');
    const moveAttackLight = findResult(results, 'balanced_mid_light', 'basic_move_then_standard_attack');
    const moveAttackHeavy = findResult(results, 'balanced_mid_heavy', 'basic_move_then_standard_attack');

    const sensitivity: MetabolicSensitivityResult[] = [
        {
            id: 'walking_vs_running',
            label: 'Walking Vs Running',
            deltaAvgActionsPerTurnOpening5: Number((((moveX2?.avgActionsPerTurnOpening5 || 0) - (moveX1?.avgActionsPerTurnOpening5 || 0)) || 0).toFixed(3)),
            deltaFirstRestTurn: Number((((moveX2?.firstRestTurn || 0) - (moveX1?.firstRestTurn || 0)) || 0).toFixed(3)),
            deltaPeakExhaustionOpening5: Number((((moveX2?.peakExhaustionOpening5 || 0) - (moveX1?.peakExhaustionOpening5 || 0)) || 0).toFixed(3)),
            mostAffectedProfiles: ['balanced_mid_standard']
        },
        {
            id: 'running_vs_sprinting',
            label: 'Running Vs Sprinting',
            deltaAvgActionsPerTurnOpening5: Number((((moveX3?.avgActionsPerTurnOpening5 || 0) - (moveX2?.avgActionsPerTurnOpening5 || 0)) || 0).toFixed(3)),
            deltaFirstRestTurn: Number((((moveX3?.firstRestTurn || 0) - (moveX2?.firstRestTurn || 0)) || 0).toFixed(3)),
            deltaPeakExhaustionOpening5: Number((((moveX3?.peakExhaustionOpening5 || 0) - (moveX2?.peakExhaustionOpening5 || 0)) || 0).toFixed(3)),
            mostAffectedProfiles: ['balanced_mid_standard']
        },
        {
            id: 'body_vs_instinct_compression',
            label: 'Body Vs Instinct Compression',
            deltaAvgActionsPerTurnOpening5: Number((((instinctMoveX2?.avgActionsPerTurnOpening5 || 0) - (bodyMoveX2?.avgActionsPerTurnOpening5 || 0)) || 0).toFixed(3)),
            deltaFirstRestTurn: Number((((instinctMoveX2?.firstRestTurn || 0) - (bodyMoveX2?.firstRestTurn || 0)) || 0).toFixed(3)),
            deltaPeakExhaustionOpening5: Number((((instinctMoveX2?.peakExhaustionOpening5 || 0) - (bodyMoveX2?.peakExhaustionOpening5 || 0)) || 0).toFixed(3)),
            mostAffectedProfiles: ['body_mid_standard', 'instinct_mid_standard']
        },
        {
            id: 'weight_move_attack_gradient',
            label: 'Weight Move+Attack Gradient',
            deltaAvgActionsPerTurnOpening5: Number((((moveAttackLight?.avgActionsPerTurnOpening5 || 0) - (moveAttackHeavy?.avgActionsPerTurnOpening5 || 0)) || 0).toFixed(3)),
            deltaFirstRestTurn: Number((((moveAttackLight?.firstRestTurn || 0) - (moveAttackHeavy?.firstRestTurn || 0)) || 0).toFixed(3)),
            deltaPeakExhaustionOpening5: Number((((moveAttackHeavy?.peakExhaustionOpening5 || 0) - (moveAttackLight?.peakExhaustionOpening5 || 0)) || 0).toFixed(3)),
            mostAffectedProfiles: ['balanced_mid_light', 'balanced_mid_heavy']
        }
    ];

    const recommendedNextCandidateChanges = targetOutcomes
        .filter((outcome) => !outcome.passed)
        .map((outcome) => {
            if (outcome.id.includes('basic_move_x1')) {
                return 'Adjust maintenance-band strain or passive base bleed before touching attack or cast bands.';
            }
            if (outcome.id.includes('basic_move_x2')) {
                return 'Tune the maintenance band or BFI ladder so running is effortful without collapsing into immediate rest.';
            }
            if (outcome.id.includes('basic_move_x3')) {
                return 'Use BFI ladder pressure and heavy-band values to keep sprinting in overdrive territory.';
            }
            if (outcome.id.includes('heavy_battleline')) {
                return 'Reduce heavy movement Spark adjustment or maintenance-band strain before touching mana pools.';
            }
            if (outcome.id.includes('instinct')) {
                return 'Adjust the Instinct BFI slope before adding more Spark reserve.';
            }
            if (outcome.id.includes('travel')) {
                return 'Increase travel recovery or exhaustion clear rather than flattening battle cadence.';
            }
            return 'Tune bands, BFI, or passive-vs-wait recovery before touching live skill costs.';
        });

    return {
        generatedAt: new Date().toISOString(),
        config: cloneIresMetabolicConfig(config),
        profileMatrix,
        results,
        targetOutcomes,
        sensitivity,
        recommendedNextCandidateChanges
    };
};
