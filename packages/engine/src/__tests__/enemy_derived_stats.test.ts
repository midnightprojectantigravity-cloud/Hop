import { describe, expect, it } from 'vitest';
import { deriveEnemyBestiaryStats, getEnemyCatalogEntry, listEnemyCatalogEntries } from '../data/enemies';
import type { EnemySubtypeId } from '../data/packs/mvp-enemy-content';

const resolveDerivedStats = (subtype: EnemySubtypeId) => {
    const entry = getEnemyCatalogEntry(subtype);
    expect(entry).toBeDefined();

    return deriveEnemyBestiaryStats({
        trinity: entry!.bestiary.trinity,
        bestiarySkills: entry!.bestiary.skills,
        runtimeSkills: entry!.runtimeSkills,
        cost: entry!.bestiary.stats.cost,
        weightClass: entry!.bestiary.stats.weightClass
    });
};

describe('enemy derived stats', () => {
    it('derives stable combat profiles for representative roster archetypes', () => {
        expect(resolveDerivedStats('footman')).toMatchObject({
            range: 1,
            damage: 6,
            type: 'melee',
            speed: 1,
            actionCooldown: 2
        });
        expect(resolveDerivedStats('raider')).toMatchObject({
            range: 2,
            damage: 7.5,
            type: 'melee',
            speed: 2,
            actionCooldown: 1
        });
        const archer = resolveDerivedStats('archer');
        expect(archer.damage).toBeCloseTo(7, 10);
        expect(archer).toMatchObject({
            range: 4,
            type: 'ranged',
            speed: 1,
            actionCooldown: 2
        });
        expect(resolveDerivedStats('bomber')).toMatchObject({
            range: 3,
            damage: 6,
            type: 'ranged',
            speed: 1,
            actionCooldown: 3
        });
        expect(resolveDerivedStats('butcher')).toMatchObject({
            range: 1,
            damage: 10,
            type: 'boss',
            speed: 1,
            actionCooldown: 1
        });
        expect(resolveDerivedStats('sentinel')).toMatchObject({
            range: 4,
            damage: 9,
            type: 'boss',
            speed: 1,
            actionCooldown: 1
        });
    });

    it('keeps every catalog bestiary statline aligned with the derivation layer', () => {
        for (const entry of listEnemyCatalogEntries()) {
            const derived = deriveEnemyBestiaryStats({
                trinity: entry.bestiary.trinity,
                bestiarySkills: entry.bestiary.skills,
                runtimeSkills: entry.runtimeSkills,
                cost: entry.bestiary.stats.cost,
                weightClass: entry.bestiary.stats.weightClass
            });
            expect(entry.bestiary.stats).toEqual(derived);
        }
    });
});
