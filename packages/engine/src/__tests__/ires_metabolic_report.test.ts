import { describe, expect, it } from 'vitest';
import { buildIresMetabolicAnalysisReport } from '../systems/evaluation/ires-metabolic-analysis';

describe('IRES metabolic report', () => {
    it('generates a band-backed report with beat workloads', () => {
        const report = buildIresMetabolicAnalysisReport();

        expect(report.config.version).toBe('ires-metabolism-v6');
        expect(report.config.actionBands.maintenance.sparkCost).toBeGreaterThan(0);
        expect(report.results.some((row) => row.workloadId === 'basic_move_x2')).toBe(true);
        expect(report.targetOutcomes.length).toBeGreaterThan(0);
    });
});
