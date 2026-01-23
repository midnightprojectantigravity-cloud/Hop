// src/systems/kinetic-kernel.ts

import { getHexLine, hexAdd, hexEquals, isHexInRectangularGrid, scaleVector } from "../hex";
import { AtomicEffect, GameState, Point } from "../types";
import { JuiceHelpers, ENVIRONMENTAL_JUICE } from "./juice-manifest";

/**
 * 1. Input Architecture
 */
export interface KineticPulseRequest {
    origin: Point;
    direction: Point; // One of the 6 axial directions
    momentum: number; // A total energy pool (integer)
}

interface UnitOnLine {
    id: string;
    pos1D: number; // Index in lineHexes
}

/**
 * processKineticPulse
 * 
 * 2. The "Dumb" Simulation Algorithm
 * 
 * Implemented as a discrete tile-by-tile iterator. 
 * This ensures deterministic behavior for skill mechanics and hazard interception.
 */
export function processKineticPulse(state: GameState, request: KineticPulseRequest): AtomicEffect[] {
    const { origin, direction, momentum } = request;
    const effects: AtomicEffect[] = [];

    // JUICE: Kinetic wave emanating from origin
    effects.push(JuiceHelpers.kineticWave(origin, direction, momentum > 6 ? 'high' : 'medium'));

    // Step A: Project the 1D Line
    // We project far enough to cover potential movement
    // momentum + 10 ensures we capture units beyond the initial momentum radius that might be pushed
    const distalPoint = hexAdd(origin, {
        q: direction.q * (momentum + 10),
        r: direction.r * (momentum + 10),
        s: direction.s * (momentum + 10)
    });
    const lineHexes = getHexLine(origin, distalPoint);

    let energyPool = momentum;

    // Identify all units on this line and map them to their 1D position
    let unitsOnLine: UnitOnLine[] = getInitialUnitsOnLine(state, lineHexes);

    // 3. The "Tick" Execution
    // Persistent as long as energy > 0 and units exist on line
    while (energyPool > 0 && unitsOnLine.length > 0) {

        // Step B: Identify the Active Chain
        // Starting from the unit closest to the origin (the wave-front)
        const chain = findActiveChain(unitsOnLine);
        if (chain.length === 0) break;

        // 1. Calculate Cost: M = number of units in Active Chain
        const cost = chain.length;

        // 2. Energy Check / Momentum Transfer
        if (energyPool < cost) {
            // Reached mass limit. Transfer remaining momentum to the lead unit.
            const leadUnit = chain[chain.length - 1];
            const remaining = energyPool;
            energyPool = 0;

            const movementPath: Point[] = [lineHexes[leadUnit.pos1D]]; // Start with current position
            for (let i = 0; i < remaining; i++) {
                const nextIdx = leadUnit.pos1D + 1;
                const nextHex = lineHexes[nextIdx];

                if (!nextHex || !isHexInRectangularGrid(nextHex, state.gridWidth, state.gridHeight) || isWall(state, nextHex)) {
                    effects.push({
                        type: 'Impact',
                        target: leadUnit.id,
                        damage: remaining - i,
                        direction
                    });
                    break;
                }

                leadUnit.pos1D = nextIdx;
                movementPath.push(nextHex);

                if (isLava(state, nextHex)) {
                    effects.push({ type: 'LavaSink', target: leadUnit.id });
                    // JUICE: Lava ripple
                    effects.push(...ENVIRONMENTAL_JUICE.lavaSink(nextHex, leadUnit.id));
                    break;
                }
            }

            // Emit single displacement with full path
            if (movementPath.length > 1) {
                effects.push({
                    type: 'Displacement',
                    target: leadUnit.id,
                    destination: movementPath[movementPath.length - 1],
                    path: movementPath,
                    animationDuration: movementPath.length * 80  // 80ms per tile
                });

                // JUICE: Momentum trail for lead unit's final push
                effects.push(JuiceHelpers.momentumTrail(movementPath, 'medium'));
            }
            break;
        }

        // 3. Obstruction Check (Full Chain)
        const leadUnit = chain[chain.length - 1];
        const nextTileIndex = leadUnit.pos1D + 1;
        const nextTileHex = lineHexes[nextTileIndex];

        // Wall or Map Edge check (Fatal obstructions)
        if (!nextTileHex || !isHexInRectangularGrid(nextTileHex, state.gridWidth, state.gridHeight) || isWall(state, nextTileHex)) {
            effects.push({
                type: 'ApplyStatus',
                target: leadUnit.id,
                status: 'stunned',
                duration: 1
            });

            // JUICE: Wall impact effects
            if (nextTileHex) {
                effects.push(...ENVIRONMENTAL_JUICE.wallImpact(nextTileHex, direction, true));
            }

            break;
        }

        // 4. Move & Drain
        // Shift every unit in the Active Chain forward exactly 1 hex
        const chainMovementPaths = new Map<string, Point[]>();
        for (const unit of chain) {
            const startPos = lineHexes[unit.pos1D];
            unit.pos1D += 1;
            const destinationHex = lineHexes[unit.pos1D];

            // Track path for each unit (start -> destination)
            chainMovementPaths.set(unit.id, [startPos, destinationHex]);
        }

        // Emit displacements with paths
        for (const [unitId, path] of chainMovementPaths.entries()) {
            effects.push({
                type: 'Displacement',
                target: unitId,
                destination: path[path.length - 1],
                path: path,
                animationDuration: 100  // Single tile movement: 100ms
            });
        }

        // JUICE: Momentum trail for chain movement
        const allChainPositions = Array.from(chainMovementPaths.values()).flat();
        if (allChainPositions.length > 0) {
            effects.push(JuiceHelpers.momentumTrail(allChainPositions, cost > 2 ? 'high' : 'medium'));
        }

        // Deduct the cost from the pool (M = M - cost)
        energyPool -= cost;

        // 5. Hazard Interception
        for (let i = unitsOnLine.length - 1; i >= 0; i--) {
            const unit = unitsOnLine[i];
            const destinationHex = lineHexes[unit.pos1D];

            if (isLava(state, destinationHex)) {
                effects.push({
                    type: 'LavaSink',
                    target: unit.id
                });
                // JUICE: Lava ripple
                effects.push(...ENVIRONMENTAL_JUICE.lavaSink(destinationHex, unit.id));
                unitsOnLine.splice(i, 1);
            }
        }

        // 6. After the collective shove, only the lead unit should continue.
        if (energyPool > 0) {
            const leadUnit = chain[chain.length - 1];
            // Force the loop to only consider the lead unit and anything further downstream
            unitsOnLine = unitsOnLine.filter(u => u.pos1D >= leadUnit.pos1D);
            // We only keep the lead unit from the current chain
            const downstream = unitsOnLine.filter(u => u.pos1D > leadUnit.pos1D);
            unitsOnLine = [leadUnit, ...downstream];
        }

    }

    return effects;
}

function getInitialUnitsOnLine(state: GameState, lineHexes: Point[]): UnitOnLine[] {
    const units: UnitOnLine[] = [];
    const allActors = [state.player, ...state.enemies];

    for (const actor of allActors) {
        const index = lineHexes.findIndex(h => hexEquals(h, actor.position));
        if (index !== -1) {
            units.push({ id: actor.id, pos1D: index });
        }
    }

    return units.sort((a, b) => a.pos1D - b.pos1D);
}

function findActiveChain(unitsOnLine: UnitOnLine[]): UnitOnLine[] {
    if (unitsOnLine.length === 0) return [];

    const chain: UnitOnLine[] = [];
    let current = unitsOnLine[0];
    chain.push(current);

    for (let i = 1; i < unitsOnLine.length; i++) {
        const next = unitsOnLine[i];
        // Chain continues if next unit is at current pos OR current pos + 1
        if (next.pos1D === current.pos1D || next.pos1D === current.pos1D + 1) {
            chain.push(next);
            current = next;
        } else {
            break;
        }
    }

    return chain;
}

function isWall(state: GameState, hex: Point): boolean {
    return state.wallPositions.some(w => hexEquals(w, hex));
}

function isLava(state: GameState, hex: Point): boolean {
    return state.lavaPositions.some(l => hexEquals(l, hex));
}

// ----------------------------------------------------------------------------
// COMPATIBILITY LAYER (OLD KERNEL TYPES)
// ----------------------------------------------------------------------------

export type KineticEntityType = 'S' | 'M' | 'I' | 'L';

export interface KineticEntity {
    id: string;
    type: KineticEntityType;
    pos: number;
}

export interface BoardState {
    entities: KineticEntity[];
    momentum: number;
    activeId?: string;
}

export interface KineticIntention {
    finalState: KineticEntity[];
    steps: KineticEntity[][];
    activeIdAtStep: string[];
    remainingMomentum: number;
}

/**
 * resolveKineticPulse (Compatibility Wrapper)
 * Still used by existing systems like movement.ts
 */
export function resolveKineticPulse(board: BoardState): KineticIntention {
    const history: KineticEntity[][] = [];
    const activeIdHistory: string[] = [];
    let entities = board.entities.map(e => ({ ...e }));
    let momentum = board.momentum;

    while (momentum > 0) {
        // Compatibility implementation of the same "dumb" logic for 1D BoardState
        const movables = entities.filter(e => e.type === 'S' || e.type === 'M').sort((a, b) => a.pos - b.pos);
        if (movables.length === 0) break;

        // Find chain starting from the active unit or first movable
        const activeUnit = entities.find(e => e.id === board.activeId) || movables[0];

        // Simple 1D chain finder
        const chain: KineticEntity[] = [activeUnit];
        let currentPos = activeUnit.pos;
        while (true) {
            const next = movables.find(m => m.pos === currentPos + 1 && !chain.includes(m));
            if (next) {
                chain.push(next);
                currentPos++;
            } else break;
        }

        const cost = chain.length;
        if (momentum < cost) break;

        // Check collision for front unit
        const leadUnit = chain[chain.length - 1];
        const nextPos = leadUnit.pos + 1;
        const collision = entities.find(e => e.type === 'I' && e.pos === nextPos);
        if (collision) break;

        // Move
        entities = entities.map(e => chain.some(c => c.id === e.id) ? { ...e, pos: e.pos + 1 } : e);
        momentum -= cost;

        history.push(entities.map(e => ({ ...e })));
        activeIdHistory.push(leadUnit.id);

        // Lava Check (if 'L' type exists in 1D state)
        const lava = entities.filter(e => e.type === 'L');
        for (const l of lava) {
            const victims = entities.filter(e => e.pos === l.pos && (e.type === 'S' || e.type === 'M'));
            for (const v of victims) {
                entities = entities.filter(e => e.id !== v.id);
            }
        }
    }

    return {
        finalState: entities,
        steps: history,
        activeIdAtStep: activeIdHistory,
        remainingMomentum: momentum
    };
}

/**
 * resolveKineticDash (Compatibility Wrapper)
 */
export function resolveKineticDash(board: BoardState): KineticIntention {
    // Specifically handles the shooter's teleport to the first blocker if needed
    // But for the "dumb" implementation, we usually just resolve as pulse.
    return resolveKineticPulse(board);
}

export function getDisplacement(initial: KineticEntity[], final: KineticEntity[]): Map<string, number> {
    const map = new Map<string, number>();
    final.forEach(f => {
        const i = initial.find(ent => ent.id === f.id);
        if (i) map.set(f.id, f.pos - i.pos);
    });
    return map;
}