/**
 * MAP GENERATION SYSTEM
 * Deterministic procedural generation of tactical arenas.
 * Optimized for mobile portrait (diamond grid).
 * TODO: Implement "Hazard Generation" (e.g. dynamic spikes or traps) using the same RNG seed.
 */
import type { Point, Room, FloorTheme, Entity } from '../types';
import type { Tile } from './tile-types';
import { BASE_TILES } from './tile-registry';
import { createHex, hexEquals, hexDistance, getDiamondGrid } from '../hex';
import { createRng, stableIdFromSeed } from './rng';
import {
    ENEMY_STATS,
    FLOOR_ENEMY_BUDGET,
    FLOOR_ENEMY_TYPES,
    FLOOR_THEMES,
    GRID_WIDTH,
    GRID_HEIGHT,
    HAZARD_PERCENTAGE
} from '../constants';
import { isSpecialTile } from '../helpers';
import { createEnemy, getEnemySkillLoadout } from './entity-factory';
import { ensureTacticalDataBootstrapped } from './tactical-data-bootstrap';
import { getBaseUnitDefinitionBySubtype } from './base-unit-registry';
import { instantiateActorFromDefinitionWithCursor, type PropensityRngCursor } from './propensity-instantiation';

export interface DungeonResult {
    rooms: Room[];
    allHexes: Point[];
    stairsPosition: Point;
    shrinePosition?: Point;
    playerSpawn: Point;
    spawnPositions: Point[];
    tiles: Map<string, Tile>;
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
    const playerSpawn = createHex(4, 9);

    // 6. Place Stairs (Top-center of playable area)
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
        if (potentialShrines.length > 0) {
            shrinePosition = potentialShrines[Math.floor(rng.next() * potentialShrines.length)];
        }
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
            shrinePosition
        }) &&
        !wallPositions.some(wp => hexEquals(wp, h)) &&
        !lavaPositions.some(lp => hexEquals(lp, h)) &&
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

    // 10. Populate Tile Map
    const tileMap = new Map<string, Tile>();

    // Fill with stone first
    for (const h of allHexes) {
        tileMap.set(`${h.q},${h.r}`, {
            baseId: 'STONE',
            position: h,
            traits: new Set(BASE_TILES.STONE.defaultTraits),
            effects: []
        });
    }

    // Apply Walls
    for (const w of wallPositions) {
        tileMap.set(`${w.q},${w.r}`, {
            baseId: 'WALL',
            position: w,
            traits: new Set(BASE_TILES.WALL.defaultTraits),
            effects: []
        });
    }

    // Apply Hazards (Lava)
    for (const l of lavaPositions) {
        tileMap.set(`${l.q},${l.r}`, {
            baseId: 'LAVA',
            position: l,
            traits: new Set(BASE_TILES.LAVA.defaultTraits),
            effects: []
        });
    }

    return {
        rooms: [mainRoom],
        allHexes,
        stairsPosition,
        shrinePosition,
        spawnPositions,
        playerSpawn,
        tiles: tileMap
    };
};

export const generateEnemies = (
    floor: number,
    spawnPositions: Point[],
    seed: string
): Entity[] => {
    ensureTacticalDataBootstrapped();

    const rng = createRng(seed + ':enemies');
    const budget = FLOOR_ENEMY_BUDGET[Math.min(floor, FLOOR_ENEMY_BUDGET.length - 1)];
    const availableTypes = (FLOOR_ENEMY_TYPES as any)[floor] || (FLOOR_ENEMY_TYPES as any)[Math.max(...Object.keys(FLOOR_ENEMY_TYPES).map(Number))];
    let propensityCursor: PropensityRngCursor = {
        rngSeed: `${seed}:enemy-propensity`,
        rngCounter: 0
    };

    const enemies: Entity[] = [];
    let remainingBudget = budget;
    const usedPositions: Point[] = [];

    while (remainingBudget > 0 && usedPositions.length < spawnPositions.length) {
        const affordableTypes = availableTypes.filter((t: string) => {
            const stats = (ENEMY_STATS as any)[t];
            return stats && stats.cost <= remainingBudget;
        });

        if (affordableTypes.length === 0) break;

        const typeIdx = Math.floor(rng.next() * affordableTypes.length);
        const enemyType = affordableTypes[typeIdx];
        const stats = (ENEMY_STATS as any)[enemyType];

        const availablePositions = spawnPositions.filter(
            p => !usedPositions.some(u => hexEquals(u, p))
        );

        if (availablePositions.length === 0) break;

        const posIdx = Math.floor(rng.next() * availablePositions.length);
        const position = availablePositions[posIdx];
        usedPositions.push(position);

        const hpScale = Math.floor(floor / 5);
        const weightClass = stats.weightClass || 'Standard';
        const enemySeedCounter = (propensityCursor.rngCounter << 8) + enemies.length;
        const enemyId = `enemy_${enemies.length}_${stableIdFromSeed(seed, enemySeedCounter, 6, enemyType)}`;

        const unitDef = getBaseUnitDefinitionBySubtype(enemyType);
        let enemy: Entity;
        if (unitDef) {
            const instantiated = instantiateActorFromDefinitionWithCursor(propensityCursor, unitDef, {
                actorId: enemyId,
                position,
                subtype: enemyType,
                factionId: 'enemy'
            });
            propensityCursor = instantiated.nextCursor;
            enemy = instantiated.actor;
        } else {
            enemy = createEnemy({
                id: enemyId,
                subtype: enemyType,
                position,
                speed: stats.speed || 50,
                skills: getEnemySkillLoadout(enemyType),
                weightClass: weightClass,
                enemyType: stats.type as 'melee' | 'ranged',
            });
        }

        const scaledEnemy = hpScale > 0
            ? {
                ...enemy,
                hp: enemy.hp + hpScale,
                maxHp: enemy.maxHp + hpScale,
            }
            : enemy;

        enemies.push({
            ...scaledEnemy,
            subtype: enemyType,
            enemyType: stats.type as 'melee' | 'ranged' | 'boss',
            actionCooldown: stats.actionCooldown ?? scaledEnemy.actionCooldown,
            isVisible: true
        });

        remainingBudget -= stats.cost;
    }

    return enemies;
};

export const getFloorTheme = (floor: number): FloorTheme => {
    return (FLOOR_THEMES as any)[floor] || 'inferno';
};

export default {
    generateDungeon,
    generateEnemies,
    getFloorTheme,
};
