import { describe, expect, it } from 'vitest';
import { createCompanion, createEnemy, createPlayer } from '../systems/entities/entity-factory';
import { resolveBaseBfi, resolveEffectiveBfi } from '../systems/ires/bfi';

describe('IRES BFI tuning', () => {
    it('raises the baseline tax curve so typical player archetypes cannot chain actions as cheaply', () => {
        const firemage = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            archetype: 'FIREMAGE'
        });
        const skirmisher = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            archetype: 'SKIRMISHER'
        });
        const assassin = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            archetype: 'ASSASSIN'
        });

        expect(resolveBaseBfi(firemage)).toBe(6);
        expect(resolveBaseBfi(skirmisher)).toBe(4);
        expect(resolveBaseBfi(assassin)).toBe(4);
    });

    it('still lets light agile units retain an efficiency edge without dropping into near-free action taxes', () => {
        const falcon = createCompanion({
            companionType: 'falcon',
            ownerId: 'player',
            position: { q: 0, r: 1, s: -1 }
        });

        expect(resolveBaseBfi(falcon)).toBe(5);
        expect(resolveEffectiveBfi(falcon)).toBe(4);
    });

    it('keeps heavy low-instinct enemies expensive enough to discourage repeated actions', () => {
        const sentinel = createEnemy({
            id: 'sentinel-bfi',
            subtype: 'sentinel',
            position: { q: 1, r: 0, s: -1 },
            hp: 30,
            maxHp: 30,
            speed: 1,
            skills: ['BASIC_MOVE', 'SENTINEL_BLAST'],
            weightClass: 'Heavy'
        });

        expect(resolveBaseBfi(sentinel)).toBe(6);
        expect(resolveEffectiveBfi(sentinel)).toBe(8);
    });
});
