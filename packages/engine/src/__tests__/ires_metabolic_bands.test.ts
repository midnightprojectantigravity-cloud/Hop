import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';

describe('IRES metabolic bands', () => {
    it('uses the same BASIC_MOVE action entry for x1, x2, and x3 workloads', () => {
        expect(DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x1.turns[0]?.actions).toEqual(['BASIC_MOVE']);
        expect(DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x2.turns[0]?.actions).toEqual(['BASIC_MOVE', 'BASIC_MOVE']);
        expect(DEFAULT_IRES_METABOLIC_CONFIG.workloadCatalog.basic_move_x3.turns[0]?.actions).toEqual(['BASIC_MOVE', 'BASIC_MOVE', 'BASIC_MOVE']);
    });

    it('keeps maintenance materially cheaper than standard and heavy', () => {
        const { maintenance, standard, heavy } = DEFAULT_IRES_METABOLIC_CONFIG.actionBands;

        expect(maintenance.sparkCost).toBeLessThan(standard.sparkCost);
        expect(maintenance.baseExhaustion).toBeLessThan(standard.baseExhaustion);
        expect(heavy.sparkCost).toBeGreaterThan(standard.sparkCost);
        expect(heavy.baseExhaustion).toBeGreaterThan(standard.baseExhaustion);
    });
});
