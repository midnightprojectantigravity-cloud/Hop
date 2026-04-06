import { describe, expect, it } from 'vitest';
import { checkStairs } from '../helpers';
import { createEnemyFromBestiary } from '../systems/entities/entity-factory';

describe('stairs boss lock', () => {
    it('blocks stairs while the butcher boss is alive', () => {
        const stairsPosition = { q: 4, r: 0, s: -4 };
        const butcher = createEnemyFromBestiary({
            id: 'boss-butcher',
            subtype: 'butcher',
            position: { q: 5, r: 2, s: -7 }
        });

        expect(checkStairs({
            stairsPosition,
            enemies: [butcher]
        } as any, stairsPosition)).toBe(false);

        expect(checkStairs({
            stairsPosition,
            enemies: [{ ...butcher, hp: 0 }]
        } as any, stairsPosition)).toBe(true);
    });
});
