import { describe, expect, it } from 'vitest';
import { buildIresStressGateReport, type IresStressArtifact } from '../../scripts/runIresStressGate';

const makeArtifact = (overrides?: Partial<IresStressArtifact>): IresStressArtifact => ({
    generatedAt: '2026-03-14T00:00:00.000Z',
    params: {
        count: 24,
        maxTurns: 60,
        policy: 'heuristic',
        policyProfileId: 'sp-v1-default',
        seedPrefix: 'ires-baseline'
    },
    archetypes: [
        {
            loadoutId: 'FIREMAGE',
            summary: {
                avgFloor: 3.2,
                avgPeakExhaustion: 41.5,
                avgRedlineActions: 0.8,
                avgSparkBurnDamage: 2.4
            },
            redlineRunRate: 0.25
        },
        {
            loadoutId: 'HUNTER',
            summary: {
                avgFloor: 3.6,
                avgPeakExhaustion: 35.1,
                avgRedlineActions: 0.2,
                avgSparkBurnDamage: 0.5
            },
            redlineRunRate: 0.08
        }
    ],
    ...overrides
});

describe('IRES stress gate', () => {
    it('passes when the candidate matches the baseline', () => {
        const baseline = makeArtifact();
        const report = buildIresStressGateReport(baseline, makeArtifact());

        expect(report.passed).toBe(true);
        expect(report.regressions).toEqual([]);
        expect(report.deltas).toEqual([
            {
                loadoutId: 'FIREMAGE',
                avgFloorDelta: 0,
                avgPeakExhaustionDelta: 0,
                avgRedlineActionsDelta: 0,
                avgSparkBurnDamageDelta: 0,
                redlineRunRateDelta: 0
            },
            {
                loadoutId: 'HUNTER',
                avgFloorDelta: 0,
                avgPeakExhaustionDelta: 0,
                avgRedlineActionsDelta: 0,
                avgSparkBurnDamageDelta: 0,
                redlineRunRateDelta: 0
            }
        ]);
    });

    it('fails when any tracked metric regresses', () => {
        const baseline = makeArtifact();
        const candidate = makeArtifact({
            archetypes: [
                {
                    loadoutId: 'FIREMAGE',
                    summary: {
                        avgFloor: 3.1,
                        avgPeakExhaustion: 42.5,
                        avgRedlineActions: 0.9,
                        avgSparkBurnDamage: 2.6
                    },
                    redlineRunRate: 0.3
                },
                baseline.archetypes[1]
            ]
        });

        const report = buildIresStressGateReport(baseline, candidate);

        expect(report.passed).toBe(false);
        expect(report.regressions).toEqual([
            { loadoutId: 'FIREMAGE', metric: 'avgFloor', baseline: 3.2, candidate: 3.1 },
            { loadoutId: 'FIREMAGE', metric: 'avgPeakExhaustion', baseline: 41.5, candidate: 42.5 },
            { loadoutId: 'FIREMAGE', metric: 'avgRedlineActions', baseline: 0.8, candidate: 0.9 },
            { loadoutId: 'FIREMAGE', metric: 'avgSparkBurnDamage', baseline: 2.4, candidate: 2.6 },
            { loadoutId: 'FIREMAGE', metric: 'redlineRunRate', baseline: 0.25, candidate: 0.3 }
        ]);
    });
});
