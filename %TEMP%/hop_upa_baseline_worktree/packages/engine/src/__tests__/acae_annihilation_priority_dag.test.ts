import { describe, expect, it } from 'vitest';
import { resolveAilmentAnnihilation } from '../systems/ailments/annihilation';
import { validateAilmentCatalog } from '../data/ailments/parser';
import type { AilmentCatalog } from '../data/ailments';

describe('ACAE annihilation priority and DAG validation', () => {
    it('resolves annihilation in deterministic priority order', () => {
        const definition = {
            id: 'burn',
            name: 'Burn',
            core: { atk: 'mind', def: 'resolve', scalingFactor: 10, baseDeposit: 1 },
            interactions: [
                { target: 'wet', ratio: 1, priority: 10 },
                { target: 'poison', ratio: 2, priority: 20 }
            ],
            hardening: { tickXpRate: 0.1, shockXpRate: 0.1, capPct: 85, xpToResistance: 1.5 }
        } as any;

        const result = resolveAilmentAnnihilation(
            definition,
            { wet: 5, poison: 2, burn: 0 },
            8
        );
        expect(result.counters.poison || 0).toBe(0);
        expect(result.counters.wet || 0).toBe(1);
        expect(result.counters.burn || 0).toBe(0);
    });

    it('fails validation when annihilation graph has a cycle', () => {
        const catalog: AilmentCatalog = {
            version: '1.0.0',
            ailments: [
                {
                    id: 'burn',
                    name: 'Burn',
                    core: { atk: 'mind', def: 'resolve', scalingFactor: 10, baseDeposit: 1 },
                    interactions: [{ target: 'wet', ratio: 1, priority: 1 }],
                    hardening: { tickXpRate: 0.1, shockXpRate: 0.1, capPct: 85, xpToResistance: 1.5 }
                },
                {
                    id: 'wet',
                    name: 'Wet',
                    core: { atk: 'instinct', def: 'body', scalingFactor: 10, baseDeposit: 1 },
                    interactions: [{ target: 'burn', ratio: 1, priority: 1 }],
                    hardening: { tickXpRate: 0.1, shockXpRate: 0.1, capPct: 85, xpToResistance: 1.5 }
                }
            ] as any
        };
        const issues = validateAilmentCatalog(catalog);
        expect(issues.some(issue => issue.message.includes('cycle'))).toBe(true);
    });
});

