/**
 * MAP GENERATION SYSTEM
 * Deterministic procedural generation of tactical arenas.
 * Optimized for mobile portrait (diamond grid).
 * TODO: Implement "Hazard Generation" (e.g. dynamic spikes or traps) using the same RNG seed.
 */
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
import { createSkill } from './skills';
import { type PhysicsComponent, type GameComponent } from './components';

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

    // 4. Identify Outer Wall (Perimeter)
    const wallPositions: Point[] = [];
    const playableHexes: Point[] = [];

    // A hex is perimeter if it's on the edge of the 9x11 diamond
    for (const h of allHexes) {
        const isMinQ = h.q === 0;
        const isMaxQ = h.q === GRID_WIDTH - 1;
        const isMinR = h.r === 0;
        const isMaxR = h.r === GRID_HEIGHT - 1;
        const sum = h.q + h.r;
        const isMinSum = sum === topLimit;
        const isMaxSum = sum === bottomLimit;

        if (isMinQ || isMaxQ || isMinR || isMaxR || isMinSum || isMaxSum) {
            wallPositions.push(h);
        } else {
            playableHexes.push(h);
        }
    }

    // 5. Determine Player Spawn (Bottom-center of playable area)
    // Usable area is 7x9 diamond.
    // Center column is q=4. Bottom row of 9x11 diamond is r=10 (for q=4).
    // Perimeter at q=4 is r=0 and r=10.
    // So playable bottom at q=4 is r=9.
    const playerSpawn = createHex(4, 9);

    // 6. Place Stairs (Top-center of playable area)
    // Playable top at q=4 is r=1.
    const stairsPosition = createHex(4, 1);

    // 7. Place Shrine (if applicable)
    let shrinePosition: Point | undefined;
    const canHaveShrine = floor % 1 === 0;
    if (canHaveShrine) {
        const potentialShrines = playableHexes.filter(h =>
            !hexEquals(h, playerSpawn) &&
            !hexEquals(h, stairsPosition) &&
            hexDistance(h, playerSpawn) >= 3
        );
        shrinePosition = potentialShrines[Math.floor(rng.next() * potentialShrines.length)];
    }

    // 8. Generate Hazards (Lava/Void)
    const hazardCount = Math.floor(playableHexes.length * HAZARD_PERCENTAGE);
    const lavaPositions: Point[] = [];

    const specialPositions = {
        playerStart: playerSpawn,
        stairsPosition,
        shrinePosition,
    };

    const availableForHazards = playableHexes.filter(h => !isSpecialTile(h, specialPositions));

    // Randomly shuffle available tiles
    const shuffled = [...availableForHazards].sort(() => rng.next() - 0.5);

    // First 15-20% are hazards
    for (let i = 0; i < hazardCount; i++) {
        if (i < shuffled.length) {
            lavaPositions.push(shuffled[i]);
        }
    }

    // 9. Spawn Positions (anything else that isn't a hazard or wall or player spawn)
    const spawnPositions = playableHexes.filter(h =>
        !isSpecialTile(h, {
            playerStart: playerSpawn,
            stairsPosition,
            shrinePosition,
            lavaPositions,
            wallPositions: [] // already in wallPositions
        }) &&
        !wallPositions.some(wp => hexEquals(wp, h)) &&
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

        const weightClass = (stats as any).weightClass || 'Standard';
        const componentsSet = new Map<string, GameComponent>();
        componentsSet.set('physics', { type: 'physics', weightClass } as PhysicsComponent);

        enemies.push({
            id: `enemy_${enemies.length}_${rng.next().toString(36).slice(2, 8)}`,
            type: 'enemy',
            subtype: enemyType,
            enemyType: stats.type as 'melee' | 'ranged',
            position,
            hp: finalHp,
            maxHp: finalMaxHp,
            speed: stats.speed || 50,
            factionId: 'enemy',
            isVisible: true,
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: (stats as any).skills?.map((s: string) => createSkill(s)).filter(Boolean) || [],
            weightClass: weightClass,
            components: componentsSet,
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
