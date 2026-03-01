import { createHex } from '../../hex';
import { createActiveSkill } from '../../skillRegistry';
import { listEnemyCatalogEntries } from '../../data/enemies';
import { DEFAULT_LOADOUTS } from '../loadout';
import { BASE_TILES } from '../tiles/tile-registry';
import { generateDungeon, generateEnemies } from '../map';
import { evaluateEncounter, evaluateEntity, evaluateMap, evaluateTile, type MapEvaluationInput, type GradeResult } from './evaluation';
import { getCalibrationProfile } from './calibration';
import type { Actor } from '../../types';
import type { Tile } from '../tiles/tile-types';

export interface EvaluatorBaselineArtifact {
    modelVersion: string;
    calibrationVersion: string;
    tileGrades: GradeResult[];
    entityGrades: {
        loadouts: GradeResult[];
        enemies: GradeResult[];
    };
    mapGrades: GradeResult[];
    encounterGrades: GradeResult[];
}

export const computeEvaluatorBaselines = (
    modelVersion = 'uel-v1',
    calibrationVersion = 'cal-v1'
): EvaluatorBaselineArtifact => {
    const calibration = getCalibrationProfile(calibrationVersion);
    const tileGrades = Object.values(BASE_TILES).map(base => {
        const tile: Tile = {
            baseId: base.id,
            position: createHex(0, 0),
            traits: new Set(base.defaultTraits),
            effects: []
        };
        return evaluateTile(tile, { calibration });
    });

    const loadoutGrades = Object.values(DEFAULT_LOADOUTS).map(loadout => {
        const actor: Actor = {
            id: `player_${loadout.id.toLowerCase()}`,
            type: 'player',
            subtype: loadout.id.toLowerCase(),
            position: createHex(0, 0),
            hp: 3,
            maxHp: 3,
            speed: 1,
            factionId: 'player',
            statusEffects: [],
            temporaryArmor: 0,
            archetype: loadout.id as any,
            activeSkills: loadout.startingSkills
                .map(s => createActiveSkill(s as any))
                .filter(Boolean)
        };
        return evaluateEntity(actor, { calibration });
    });

    const enemyGrades = listEnemyCatalogEntries().map(entry => {
        const subtype = entry.subtype;
        const stats = entry.bestiary.stats;
        const actor: Actor = {
            id: `enemy_${subtype}`,
            type: 'enemy',
            subtype,
            position: createHex(0, 0),
            hp: stats.hp,
            maxHp: stats.maxHp,
            speed: stats.speed || 1,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [...entry.runtimeSkills.base, ...entry.runtimeSkills.passive]
                .map(s => createActiveSkill(s as any))
                .filter(Boolean)
        };
        return evaluateEntity(actor, { calibration });
    });

    const mapGrades = [1, 3, 5].map(floor => {
        const seed = `eval-map-${floor}`;
        const dungeon = generateDungeon(floor, seed);
        const input: MapEvaluationInput = {
            id: `map_floor_${floor}`,
            tiles: dungeon.tiles,
            playerSpawn: dungeon.playerSpawn,
            stairsPosition: dungeon.stairsPosition,
            shrinePosition: dungeon.shrinePosition
        };
        return evaluateMap(input, { calibration });
    });

    const encounterGrades = [1, 3, 5].map(floor => {
        const seed = `eval-encounter-${floor}`;
        const dungeon = generateDungeon(floor, seed);
        const enemies = generateEnemies(floor, dungeon.spawnPositions, seed);
        return evaluateEncounter({
            id: `encounter_floor_${floor}`,
            map: {
                id: `encounter_map_floor_${floor}`,
                tiles: dungeon.tiles,
                playerSpawn: dungeon.playerSpawn,
                stairsPosition: dungeon.stairsPosition,
                shrinePosition: dungeon.shrinePosition
            },
            enemies,
            objectives: [
                { id: 'TURN_LIMIT', target: 60 },
                { id: 'HAZARD_CONSTRAINT', target: 3 }
            ]
        }, { calibration });
    });

    return {
        modelVersion,
        calibrationVersion: calibration.version,
        tileGrades,
        entityGrades: {
            loadouts: loadoutGrades,
            enemies: enemyGrades
        },
        mapGrades,
        encounterGrades
    };
};
