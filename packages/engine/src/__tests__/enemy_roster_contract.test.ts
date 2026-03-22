import { describe, expect, it } from 'vitest';
import { listEnemyCatalogEntries } from '../data/enemies';
import { resolveBaseBfi, resolveEffectiveBfi } from '../systems/ires/bfi';
import { createEnemy } from '../systems/entities/entity-factory';

describe('enemy roster contract', () => {
    it('assigns every enemy subtype one grounded combat role and explicit armor burden tier', () => {
        const entries = listEnemyCatalogEntries();

        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(entry.contract.combatRole).toBeTruthy();
            expect(entry.contract.metabolicProfile.armorBurdenTier).toBeTruthy();
            expect(entry.contract.balanceTags.length).toBeGreaterThan(0);
        }
    });

    it('keeps authored enemy BFI inside the intended contract bands', () => {
        for (const entry of listEnemyCatalogEntries()) {
            const actor = createEnemy({
                id: `contract-${entry.subtype}`,
                subtype: entry.subtype,
                position: { q: 0, r: 0, s: 0 },
                hp: entry.bestiary.stats.hp,
                maxHp: entry.bestiary.stats.maxHp,
                speed: entry.bestiary.stats.speed,
                skills: entry.runtimeSkills.base,
                weightClass: entry.bestiary.stats.weightClass,
                armorBurdenTier: entry.contract.metabolicProfile.armorBurdenTier,
                enemyType: entry.bestiary.stats.type,
                trinity: entry.bestiary.trinity
            });

            const baseBfi = resolveBaseBfi(actor);
            const effectiveBfi = resolveEffectiveBfi(actor);
            const [baseMin, baseMax] = entry.contract.metabolicProfile.targetBaseBfiBand;
            const [effMin, effMax] = entry.contract.metabolicProfile.targetEffectiveBfiBand;

            expect(baseBfi).toBeGreaterThanOrEqual(baseMin);
            expect(baseBfi).toBeLessThanOrEqual(baseMax);
            expect(effectiveBfi).toBeGreaterThanOrEqual(effMin);
            expect(effectiveBfi).toBeLessThanOrEqual(effMax);
        }
    });
});
