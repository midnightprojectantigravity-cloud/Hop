/**
 * HEX BRIDGE
 * Translates between the 3D Hex coordinate system and the 1D Kinetic Kernel.
 *
 * Responsibilities:
 * - Project hex entities onto a 1D line along an axial direction
 * - Inject virtual walls at map boundaries
 * - Translate 1D positions back to hex coordinates after simulation
 *
 * This bridge allows the pure physics kernel to remain headless and testable
 * while working with the game's hex-based coordinate system.
 */

import type { Point, GameState } from '../types';
import { getDirectionFromTo } from '../hex';
import type { BoardState, KineticEntityType, KineticEntity } from './kinetic-kernel';

// ============================================================================
// TYPES
// ============================================================================

/** Direction vectors for the 6 axial directions */
export const HEX_DIRECTIONS: { [key: string]: Point } = {
    'E': { q: 1, r: 0, s: -1 },
    'NE': { q: 1, r: -1, s: 0 },
    'NW': { q: 0, r: -1, s: 1 },
    'W': { q: -1, r: 0, s: 1 },
    'SW': { q: -1, r: 1, s: 0 },
    'SE': { q: 0, r: 1, s: -1 }
};

export type DirectionKey = keyof typeof HEX_DIRECTIONS;

export interface KineticSimulationInput {
    direction: DirectionKey;
    state: BoardState;
    /** Map from 1D position back to hex coordinate */
    positionMap: Map<number, Point>;
    /** The origin hex (shooter's starting position) */
    origin: Point;
    /** The direction vector for translation */
    directionVector: Point;
}

// ============================================================================
// CORE BRIDGE FUNCTIONS
// ============================================================================

/**
 * prepareKineticSimulation
 * THE GATHER PHASE: Scans the game state and projects all relevant entities
 * onto a 1D line in the specified direction.
 *
 * @param actorId - The ID of the actor initiating the dash (becomes 'S')
 * @param targetHex - The target hex to determine direction
 * @param momentum - The momentum available for the dash
 * @param state - The current game state
 * @returns KineticSimulationInput ready for the kernel
 */
export function prepareKineticSimulation(
    actorId: string,
    targetHex: Point,
    momentum: number,
    state: GameState
): KineticSimulationInput {
    // Find the actor
    const actor = actorId === 'player'
        ? state.player
        : state.enemies.find(e => e.id === actorId);

    if (!actor) throw new Error(`Actor ${actorId} not found`);

    const origin = actor.position;
    const dirKey = getDirectionKey(origin, targetHex);
    const dirVec = HEX_DIRECTIONS[dirKey];

    // Collect all entities that matter for kinetic simulation
    const allEntities: { id: string; type: 'player' | 'enemy' | 'wall' | 'lava'; hex: Point }[] = [];

    // Player
    allEntities.push({ id: 'player', type: 'player', hex: state.player.position });

    // Enemies
    for (const enemy of state.enemies) {
        if (enemy.hp > 0) {
            allEntities.push({ id: enemy.id, type: 'enemy', hex: enemy.position });
        }
    }

    // Walls
    for (let i = 0; i < state.wallPositions.length; i++) {
        allEntities.push({ id: `wall_${i}`, type: 'wall', hex: state.wallPositions[i] });
    }

    // Lava (for interception detection in apply phase)
    for (let i = 0; i < state.lavaPositions.length; i++) {
        allEntities.push({ id: `lava_${i}`, type: 'lava', hex: state.lavaPositions[i] });
    }

    // Project to 1D
    const positionMap = new Map<number, Point>();
    const scenario: KineticEntity[] = [];

    for (const ent of allEntities) {
        const projection = projectToLine(origin, dirVec, ent.hex);

        if (projection !== null) {
            positionMap.set(projection, ent.hex);

            // Translate entity type to kinetic type
            let kType: KineticEntityType;
            if (ent.id === actorId) {
                kType = 'S'; // Shooter
            } else if (ent.type === 'wall') {
                kType = 'I'; // Immovable
            } else if (ent.type === 'lava') {
                kType = 'L'; // Lava (handled in apply phase)
            } else {
                kType = 'M'; // Movable (other actors)
            }

            scenario.push({ id: ent.id, type: kType, pos: projection });
        }
    }

    // Inject map boundary as a virtual wall
    let boundaryPos = calculateBoundaryPos(origin, dirVec, state.gridWidth, state.gridHeight);

    // Boundary Buffer: Map Edge must be at least maxEntityPos + 1
    const maxEntityPos = scenario.length > 0 ? Math.max(...scenario.map(e => e.pos)) : 0;
    if (boundaryPos <= maxEntityPos) {
        boundaryPos = maxEntityPos + 1;
    }

    scenario.push({ id: 'MAP_EDGE', type: 'I', pos: boundaryPos });

    // Sort by position for deterministic processing
    scenario.sort((a, b) => a.pos - b.pos);

    console.log(`--- KINETIC BRIDGE: START ---`);
    console.log(`Direction: ${dirKey} | Target Hex: q:${targetHex.q}, r:${targetHex.r}`);
    console.log(`Entities projected:`, scenario.map(e => `ID: ${e.id}, 1D-Pos: ${e.pos}, Type: ${e.type}`));

    return {
        direction: dirKey as DirectionKey,
        state: {
            entities: scenario,
            momentum,
            activeId: actorId
        },
        positionMap,
        origin,
        directionVector: dirVec
    };
}

/**
 * translate1DToHex
 * THE APPLY PHASE HELPER: Converts a 1D position back to hex coordinates.
 *
 * @param origin - The origin hex (shooter's starting position)
 * @param direction - The direction vector
 * @param pos1D - The 1D position from the kernel
 * @returns The hex coordinate
 */
export function translate1DToHex(origin: Point, direction: Point, pos1D: number): Point {
    return {
        q: origin.q + direction.q * pos1D,
        r: origin.r + direction.r * pos1D,
        s: origin.s + direction.s * pos1D
    };
}

/**
 * translateKineticResultToHex
 * Batch translates all entities from a kinetic result back to hex positions.
 *
 * @param entities - The entities from the kernel's final state
 * @param origin - The origin hex
 * @param direction - The direction vector
 * @returns Map of entity ID to hex position
 */
export function translateKineticResultToHex(
    entities: KineticEntity[],
    origin: Point,
    direction: Point
): Map<string, Point> {
    const result = new Map<string, Point>();

    for (const ent of entities) {
        if (ent.id !== 'MAP_EDGE') {
            result.set(ent.id, translate1DToHex(origin, direction, ent.pos));
        }
    }

    return result;
}

// ============================================================================
// PROJECTION HELPERS
// ============================================================================

/**
 * projectToLine
 * Projects a hex position onto the 1D line from origin in the given direction.
 * Returns null if the hex is not on the line.
 */
function projectToLine(origin: Point, dirVec: Point, target: Point): number | null {
    const dq = target.q - origin.q;
    const dr = target.r - origin.r;
    const ds = target.s - origin.s;

    // Find the scalar t such that target = origin + t * dirVec
    let t: number | null = null;

    if (dirVec.q !== 0) t = dq / dirVec.q;
    else if (dirVec.r !== 0) t = dr / dirVec.r;
    else if (dirVec.s !== 0) t = ds / dirVec.s;

    // Verify all components match and t is an integer
    const isOnLine = t !== null &&
        Number.isInteger(t) &&
        dq === dirVec.q * t &&
        dr === dirVec.r * t &&
        ds === dirVec.s * t;

    return isOnLine ? Math.floor(t!) : null;
}

/**
 * getDirectionKey
 * Determines which of the 6 axial directions connects start to target.
 * Throws if target is not on an axial line from start.
 */
export function getDirectionKey(start: Point, target: Point): DirectionKey {
    for (const [key, _vec] of Object.entries(HEX_DIRECTIONS)) {
        // Use the centralized strict axial check from hex.ts
        const dirIdx = HEX_DIRECTIONS_MAP[key];
        const checkIdx = getDirectionFromTo(start, target);

        if (checkIdx === dirIdx) {
            return key as DirectionKey;
        }
    }
    throw new Error("Target is not on a valid axial line from start");
}

const HEX_DIRECTIONS_MAP: Record<string, number> = {
    'E': 0, 'NE': 1, 'NW': 2, 'W': 3, 'SW': 4, 'SE': 5
};

/**
 * calculateBoundaryPos
 * Finds the 1D position where the line from origin in direction exits the map bounds.
 */
function calculateBoundaryPos(origin: Point, dir: Point, width: number, height: number): number {
    let t = 1;
    const maxIterations = 50; // Safety limit

    while (t < maxIterations) {
        const q = origin.q + dir.q * t;
        const r = origin.r + dir.r * t;

        // Diamond grid boundary check
        const sum = q + r;
        const topLimit = Math.floor(width / 2);
        const bottomLimit = (width - 1) + (height - 1) - topLimit;

        const inBounds = q >= 0 && q < width &&
            r >= 0 && r < height &&
            sum >= topLimit && sum <= bottomLimit;

        if (!inBounds) {
            return t; // This is where the boundary wall should be
        }
        t++;
    }

    return maxIterations;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { HEX_DIRECTIONS as KINETIC_DIRECTIONS };