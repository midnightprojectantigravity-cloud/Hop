/**
 * MAP GENERATION SYSTEM
 * Public compatibility facade over the world compiler.
 */
import { FLOOR_THEMES } from '../constants';
import type { FloorTheme, Point } from '../types';
import type { DungeonGenerationOptions, DungeonResult } from '../generation/compiler';
import { compileStandaloneFloor } from '../generation/compiler';
import { generateFloorEnemies } from '../generation/enemy-generation';

export type { DungeonGenerationOptions, DungeonResult } from '../generation/compiler';

export const generateDungeon = (
    floor: number,
    seed: string,
    options?: DungeonGenerationOptions
): DungeonResult => {
    return compileStandaloneFloor(floor, seed, options).dungeon;
};

export const generateEnemies = (
    floor: number,
    spawnPositions: Point[],
    seed: string
) => {
    return generateFloorEnemies(floor, spawnPositions, seed);
};

export const getFloorTheme = (floor: number): FloorTheme => {
    return (FLOOR_THEMES[floor] as FloorTheme | undefined) || 'inferno';
};

export default {
    generateDungeon,
    generateEnemies,
    getFloorTheme,
};
