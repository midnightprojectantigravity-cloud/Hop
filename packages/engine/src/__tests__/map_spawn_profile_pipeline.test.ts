import { describe, expect, it } from 'vitest';
import { getEnemyCatalogEntry, getFloorSpawnProfile } from '../data/enemies';
import { generateDungeon, generateEnemies } from '../systems/map';
import { bootstrapTacticalData, resetTacticalDataBootstrap } from '../systems/tactical-data-bootstrap';

describe('map spawn profile pipeline', () => {
    it('clamps floor spawn profile lookups at max configured floor', () => {
        const floorNine = getFloorSpawnProfile(9);
        const floorNinetyNine = getFloorSpawnProfile(99);

        expect(floorNinetyNine.floor).toBeGreaterThanOrEqual(floorNine.floor);
        expect(floorNinetyNine.budget).toBe(0);
        expect(floorNinetyNine.allowedSubtypes.length).toBe(0);
        expect(floorNine.role).toBe('boss');
    });

    it('uses catalog-backed floor spawn profiles for enemy generation', () => {
        resetTacticalDataBootstrap();
        bootstrapTacticalData();

        const floor = 1;
        const seed = 'profile-pipeline-floor-1';
        const dungeon = generateDungeon(floor, seed);
        const enemies = generateEnemies(floor, dungeon.spawnPositions, seed);
        const profile = getFloorSpawnProfile(floor);

        expect(profile.allowedSubtypes).toEqual(['footman']);
        expect(profile.composition.frontlineMin).toBe(1);
        expect(enemies.length).toBeGreaterThan(0);
        expect(enemies.every(enemy => enemy.subtype === 'footman')).toBe(true);

        const spentBudget = enemies.reduce((sum, enemy) => {
            const cost = getEnemyCatalogEntry(enemy.subtype || '')?.bestiary.stats.cost || 0;
            return sum + cost;
        }, 0);
        expect(spentBudget).toBeLessThanOrEqual(profile.budget);

        resetTacticalDataBootstrap();
    });

    it('enforces the boss composition profile at the top configured floor', () => {
        resetTacticalDataBootstrap();
        bootstrapTacticalData();

        const floor = 9;
        const seed = 'profile-pipeline-floor-9';
        const dungeon = generateDungeon(floor, seed);
        const enemies = generateEnemies(floor, dungeon.spawnPositions, seed);
        const sentinelCount = enemies.filter(enemy => enemy.subtype === 'sentinel').length;
        const rangedOrBossCount = enemies.filter(enemy => enemy.enemyType === 'ranged' || enemy.enemyType === 'boss').length;
        const frontlineCount = enemies.filter(enemy => {
            const entry = getEnemyCatalogEntry(enemy.subtype || '');
            return entry?.contract.balanceTags.includes('frontline');
        }).length;
        const profile = getFloorSpawnProfile(floor);

        expect(sentinelCount).toBeLessThanOrEqual(profile.composition.bossAnchorMax);
        expect(rangedOrBossCount).toBeLessThanOrEqual(profile.composition.rangedMax);
        expect(frontlineCount).toBeGreaterThanOrEqual(profile.composition.frontlineMin);

        resetTacticalDataBootstrap();
    });
});
