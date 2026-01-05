// src/game/mapGeneration.ts
// Tight tactical grid generation for mobile portrait mode

import type { Point, Room, FloorTheme, Entity } from './types';
import { createHex, hexEquals, hexDistance, getDiamondGrid } from './hex';
import { createRng } from './rng';
import {
    ENEMY_STATS,
    FLOOR_ENEMY_BUDGET,
    FLOOR_ENEMY_TYPES,
    FLOOR_THEMES,
    GRID_WIDTH,
    GRID_HEIGHT,
    HAZARD_PERCENTAGE
} from './constants';
import { isSpecialTile } from './helpers';

export interface DungeonResult {
    rooms: Room[];
    allHexes: Point[];
    stairsPosition: Point;
    shrinePosition?: Point;
    lavaPositions: Point[];
    wallPositions: Point[];
    spawnPositions: Point[];
    playerSpawn: Point;
}

/**
 * Generate a single tactical arena floor
 */
export const generateDungeon = (
    floor: number,
    seed: string
): DungeonResult => {
    const rng = createRng(seed);

    // 1. Generate the base diamond grid
    const allHexes = getDiamondGrid(GRID_WIDTH, GRID_HEIGHT);

    const topLimit = Math.floor(GRID_WIDTH / 2);
    const bottomLimit = (GRID_WIDTH - 1) + (GRID_HEIGHT - 1) - topLimit;

    // 2. Determine Player Spawn (Bottom-center)
    const playerSpawn = createHex(bottomLimit - (GRID_HEIGHT - 1), GRID_HEIGHT - 1);

    // 3. Place Stairs (Top-center)
    const stairsPosition = createHex(topLimit, 0);

    // 4. Place Shrine (if applicable)
    let shrinePosition: Point | undefined;
    const canHaveShrine = floor % 1 === 0; // Shrine every floor as per design doc? "Shrines appear on every floor."
    if (canHaveShrine) {
        const potentialShrines = allHexes.filter(h =>
            !hexEquals(h, playerSpawn) &&
            !hexEquals(h, stairsPosition) &&
            hexDistance(h, playerSpawn) >= 3
        );
        shrinePosition = potentialShrines[Math.floor(rng.next() * potentialShrines.length)];
    }

    // 5. Generate Hazards (Lava/Void) and Walls
    // Hazards: 15-20%
    const hazardCount = Math.floor(allHexes.length * HAZARD_PERCENTAGE);
    const lavaPositions: Point[] = [];
    const wallPositions: Point[] = []; // Wall: Dark Grey, Elevated; blocks movement

    const specialPositions = {
        playerStart: playerSpawn,
        stairsPosition,
        shrinePosition,
    };

    const availableForHazards = allHexes.filter(h => !isSpecialTile(h, specialPositions));

    // Randomly shuffle available tiles
    const shuffled = [...availableForHazards].sort(() => rng.next() - 0.5);

    // First 15-20% are hazards
    for (let i = 0; i < hazardCount; i++) {
        if (i < shuffled.length) {
            lavaPositions.push(shuffled[i]);
        }
    }

    // Add some random walls (e.g. 10%)
    const wallCount = Math.floor(allHexes.length * 0.1);
    for (let i = hazardCount; i < hazardCount + wallCount; i++) {
        if (i < shuffled.length) {
            wallPositions.push(shuffled[i]);
        }
    }

    // 6. Spawn Positions (anything else that isn't a hazard or wall or player spawn)
    const spawnPositions = allHexes.filter(h =>
        !isSpecialTile(h, {
            playerStart: playerSpawn,
            stairsPosition,
            shrinePosition,
            lavaPositions,
            wallPositions
        }) &&
        hexDistance(h, playerSpawn) >= 3
    );

    // Mock a single room for backward compatibility
    const mainRoom: Room = {
        id: 'arena',
        type: 'combat',
        center: createHex(Math.floor(GRID_WIDTH / 2), Math.floor(GRID_HEIGHT / 2)),
        hexes: allHexes,
        connections: []
    };

    return {
        rooms: [mainRoom],
        allHexes,
        stairsPosition,
        shrinePosition,
        lavaPositions,
        wallPositions,
        spawnPositions,
        playerSpawn
    };
};

export const generateEnemies = (
    floor: number,
    spawnPositions: Point[],
    seed: string
): Entity[] => {
    const rng = createRng(seed + ':enemies');
    const budget = FLOOR_ENEMY_BUDGET[Math.min(floor, FLOOR_ENEMY_BUDGET.length - 1)];
    const availableTypes = FLOOR_ENEMY_TYPES[Math.min(floor, 5)] || FLOOR_ENEMY_TYPES[5];

    const enemies: Entity[] = [];
    let remainingBudget = budget;
    const usedPositions: Point[] = [];

    while (remainingBudget > 0 && usedPositions.length < spawnPositions.length) {
        const affordableTypes = availableTypes.filter(t => {
            const stats = ENEMY_STATS[t as keyof typeof ENEMY_STATS];
            return stats && stats.cost <= remainingBudget;
        });

        if (affordableTypes.length === 0) break;

        const typeIdx = Math.floor(rng.next() * affordableTypes.length);
        const enemyType = affordableTypes[typeIdx];
        const stats = ENEMY_STATS[enemyType as keyof typeof ENEMY_STATS];

        const availablePositions = spawnPositions.filter(
            p => !usedPositions.some(u => hexEquals(u, p))
        );

        if (availablePositions.length === 0) break;

        const posIdx = Math.floor(rng.next() * availablePositions.length);
        const position = availablePositions[posIdx];
        usedPositions.push(position);

        // Health scaling: +1 HP every 5 floors
        const hpScale = Math.floor(floor / 5);
        const finalHp = stats.hp + hpScale;
        const finalMaxHp = stats.maxHp + hpScale;

        enemies.push({
            id: `enemy_${enemies.length}_${rng.next().toString(36).slice(2, 8)}`,
            type: 'enemy',
            subtype: enemyType,
            enemyType: stats.type as 'melee' | 'ranged',
            position,
            hp: finalHp,
            maxHp: finalMaxHp,
            isVisible: true,
        });

        remainingBudget -= stats.cost;
    }

    return enemies;
};

export const getFloorTheme = (floor: number): FloorTheme => {
    return (FLOOR_THEMES[floor as keyof typeof FLOOR_THEMES] || 'catacombs') as FloorTheme;
};

export default {
    generateDungeon,
    generateEnemies,
    getFloorTheme,
};
