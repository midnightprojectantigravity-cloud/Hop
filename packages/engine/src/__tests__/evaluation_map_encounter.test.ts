import { describe, expect, it } from 'vitest';
import { generateDungeon, generateEnemies } from '../systems/map';
import { evaluateEncounter, evaluateMap, type MapEvaluationInput } from '../systems/evaluation';

describe('Map and Encounter evaluation', () => {
    it('produces deterministic map grades', () => {
        const dungeon = generateDungeon(2, 'eval-map-seed');
        const mapInput: MapEvaluationInput = {
            id: 'map_eval_test',
            tiles: dungeon.tiles,
            playerSpawn: dungeon.playerSpawn,
            stairsPosition: dungeon.stairsPosition,
            shrinePosition: dungeon.shrinePosition
        };
        const first = evaluateMap(mapInput);
        const second = evaluateMap(mapInput);
        expect(first).toEqual(second);
    });

    it('produces deterministic encounter grades with difficulty band', () => {
        const dungeon = generateDungeon(3, 'eval-enc-seed');
        const enemies = generateEnemies(3, dungeon.spawnPositions, 'eval-enc-seed');
        const payload = {
            id: 'encounter_eval_test',
            map: {
                id: 'encounter_map_eval_test',
                tiles: dungeon.tiles,
                playerSpawn: dungeon.playerSpawn,
                stairsPosition: dungeon.stairsPosition,
                shrinePosition: dungeon.shrinePosition
            },
            enemies,
            objectives: [{ id: 'TURN_LIMIT', target: 60 }]
        };
        const first = evaluateEncounter(payload);
        const second = evaluateEncounter(payload);
        expect(first).toEqual(second);
        expect(['low', 'medium', 'high']).toContain(first.metadata?.difficultyBand);
    });
});
