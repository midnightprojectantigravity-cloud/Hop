import { describe, expect, it } from 'vitest';
import { createCompanion, createEnemy, createPlayer } from '../systems/entities/entity-factory';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import { resolveBaseBfi, resolveEffectiveBfi } from '../systems/ires/bfi';
import { resolveMetabolicTaxRow } from '../systems/ires/metabolic-tax-ladder';

describe('IRES BFI tuning', () => {
    it('resolves the logarithmic archetype anchors exactly', () => {
        const subHuman = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 0, instinct: 0, mind: 0 },
            armorBurdenTier: 'None'
        });
        const standardHuman = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 10, instinct: 10, mind: 10 },
            armorBurdenTier: 'None'
        });
        const topInstinct = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 10, instinct: 30, mind: 10 },
            armorBurdenTier: 'None'
        });
        const eliteAthlete = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 30, instinct: 30, mind: 30 },
            armorBurdenTier: 'None'
        });
        const apexInstinct = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 10, instinct: 100, mind: 10 },
            armorBurdenTier: 'None'
        });
        const superhuman = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 100, instinct: 100, mind: 100 },
            armorBurdenTier: 'None'
        });

        expect(resolveBaseBfi(subHuman)).toBe(14);
        expect(resolveBaseBfi(standardHuman)).toBe(9);
        expect(resolveBaseBfi(topInstinct)).toBe(7);
        expect(resolveBaseBfi(eliteAthlete)).toBe(7);
        expect(resolveBaseBfi(apexInstinct)).toBe(6);
        expect(resolveBaseBfi(superhuman)).toBe(5);
    });

    it('applies burden tiers as flat additive BFI penalties', () => {
        const standardHuman = { body: 10, instinct: 10, mind: 10 };
        const none = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: standardHuman,
            armorBurdenTier: 'None'
        });
        const light = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: standardHuman,
            armorBurdenTier: 'Light'
        });
        const medium = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: standardHuman,
            armorBurdenTier: 'Medium'
        });
        const heavy = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: standardHuman,
            armorBurdenTier: 'Heavy'
        });

        expect(resolveEffectiveBfi(none)).toBe(9);
        expect(resolveEffectiveBfi(light)).toBe(10);
        expect(resolveEffectiveBfi(medium)).toBe(11);
        expect(resolveEffectiveBfi(heavy)).toBe(12);
    });

    it('defaults armor burden from weight class when no explicit tier is authored', () => {
        const falcon = createCompanion({
            companionType: 'falcon',
            ownerId: 'player',
            position: { q: 0, r: 1, s: -1 },
            trinity: { body: 2, instinct: 9, mind: 2 }
        });
        const sentinel = createEnemy({
            id: 'sentinel-bfi',
            subtype: 'sentinel',
            position: { q: 1, r: 0, s: -1 },
            hp: 30,
            maxHp: 30,
            speed: 1,
            skills: ['BASIC_MOVE', 'SENTINEL_BLAST'],
            weightClass: 'Heavy',
            trinity: { body: 0, instinct: 0, mind: 0 }
        });

        expect(resolveEffectiveBfi(falcon)).toBe(resolveBaseBfi(falcon));
        expect(resolveBaseBfi(sentinel)).toBe(14);
        expect(resolveEffectiveBfi(sentinel)).toBe(12);
    });

    it('selects the expected metabolic tax rows at the ladder boundaries', () => {
        const standardHeavy = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 10, instinct: 10, mind: 10 },
            armorBurdenTier: 'Heavy'
        });
        const superhumanLight = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            trinity: { body: 100, instinct: 100, mind: 100 },
            armorBurdenTier: 'Light'
        });

        expect(resolveEffectiveBfi(standardHeavy)).toBe(12);
        expect(resolveMetabolicTaxRow(DEFAULT_IRES_METABOLIC_CONFIG.metabolicTaxLadder, resolveEffectiveBfi(standardHeavy))).toEqual(
            DEFAULT_IRES_METABOLIC_CONFIG.metabolicTaxLadder[12]
        );
        expect(resolveEffectiveBfi(superhumanLight)).toBe(6);
        expect(resolveMetabolicTaxRow(DEFAULT_IRES_METABOLIC_CONFIG.metabolicTaxLadder, resolveEffectiveBfi(superhumanLight))).toEqual(
            DEFAULT_IRES_METABOLIC_CONFIG.metabolicTaxLadder[6]
        );
    });
});
