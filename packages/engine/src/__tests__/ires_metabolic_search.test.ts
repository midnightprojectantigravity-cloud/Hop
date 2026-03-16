import { describe, expect, it } from 'vitest';
import { runIresMetabolicSearch } from '../systems/ires/metabolic-search';

describe('IRES metabolic search', () => {
    it('returns ranked deterministic candidates', () => {
        const payload = runIresMetabolicSearch();

        expect(payload.candidates.length).toBeGreaterThan(0);
        expect(payload.bestCandidate.totalScore).toBeLessThanOrEqual(payload.candidates[payload.candidates.length - 1]!.totalScore);
        expect(payload.bestCandidate.targetOutcomes.length).toBeGreaterThan(0);
    });
});
