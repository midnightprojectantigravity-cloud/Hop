import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BaseUnitDefinition } from '../data/contracts';
import { TACTICAL_CORE_MVP_PACK } from '../data/packs/mvp-pack';
import { registerBaseUnitDefinition } from '../systems/base-unit-registry';
import { generateDungeon, generateEnemies } from '../systems/map';
import { bootstrapTacticalData, resetTacticalDataBootstrap } from '../systems/tactical-data-bootstrap';

const summarizeEnemies = (enemies: ReturnType<typeof generateEnemies>) =>
    enemies.map(enemy => ({
        id: enemy.id,
        subtype: enemy.subtype,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        speed: enemy.speed,
        position: enemy.position,
        skills: (enemy.activeSkills || []).map(skill => skill.id).sort()
    }));

describe('map spawn registry', () => {
    beforeEach(() => {
        resetTacticalDataBootstrap();
        bootstrapTacticalData();
    });

    afterEach(() => {
        resetTacticalDataBootstrap();
    });

    it('produces deterministic enemy spawns for identical seed inputs', () => {
        const dungeon = generateDungeon(4, 'spawn-registry-seed');
        const left = generateEnemies(4, dungeon.spawnPositions, 'spawn-registry-seed');
        const right = generateEnemies(4, dungeon.spawnPositions, 'spawn-registry-seed');

        expect(summarizeEnemies(left)).toEqual(summarizeEnemies(right));
    });

    it('uses base-unit registry definitions when available for subtype spawn', () => {
        const baseFootman = TACTICAL_CORE_MVP_PACK.units.find(unit => unit.subtype === 'footman');
        expect(baseFootman).toBeDefined();

        const override: BaseUnitDefinition = {
            ...(baseFootman as BaseUnitDefinition),
            id: 'ENEMY_FOOTMAN_TEST_V2',
            instantiate: {
                ...(baseFootman as BaseUnitDefinition).instantiate,
                seedSalt: 'footman-override'
            },
            skillLoadout: {
                ...(baseFootman as BaseUnitDefinition).skillLoadout,
                baseSkillIds: [
                    ...(baseFootman as BaseUnitDefinition).skillLoadout.baseSkillIds,
                    'TEST_ONLY_SKILL'
                ]
            }
        };
        registerBaseUnitDefinition(override);

        const dungeon = generateDungeon(1, 'spawn-registry-override');
        const enemies = generateEnemies(1, dungeon.spawnPositions, 'spawn-registry-override');

        expect(enemies.length).toBeGreaterThan(0);
        expect(
            enemies.every(enemy => enemy.activeSkills.some(skill => String(skill.id) === 'TEST_ONLY_SKILL'))
        ).toBe(true);
    });
});
