import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDirection, hexAdd } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { SpatialSystem } from '../systems/SpatialSystem';
import { UnifiedTileService } from '../systems/unified-tile-service';
import { consumeRandom } from '../systems/rng';
import { getActorAt } from '../helpers';

/**
 * KINETIC_TRI_TRAP Skill
 * 
 * Deployment: Spawns 3 traps on random walkable axial tiles at Range 2.
 * New cast replaces old traps.
 * 
 * Traits:
 * - Hidden to enemies (AI Blindness)
 * - 1 HP (Destroyed by AOE)
 * - Non-blocking (Doesn't occupy tile/LoS)
 * 
 * Trigger: Non-flying unit attempts to enter the hex.
 * Effect: Outward Radial Fling (Magnitude 3). Movement is interrupted.
 * 
 * Cooldowns:
 * - Skill CD: 3
 * - Individual Trap Reset CD: 2
 */

const TRAP_RANGE = 2;
const TRAP_COUNT = 3;
const FLING_MAGNITUDE = 3;
const SKILL_COOLDOWN = 3;
const TRAP_RESET_CD = 2;

/**
 * Get the 6 axial directions
 */
function getAxialTilesAtRange(origin: Point, range: number): Point[] {
    const tiles: Point[] = [];
    for (let dir = 0; dir < 6; dir++) {
        let pos = origin;
        for (let step = 0; step < range; step++) {
            pos = hexAdd(pos, hexDirection(dir));
        }
        tiles.push(pos);
    }
    return tiles;
}

/**
 * Get walkable axial tiles at specified range
 */
function getValidTrapPositions(state: GameState, origin: Point, range: number): Point[] {
    const axialTiles = getAxialTilesAtRange(origin, range);

    return axialTiles.filter(pos => {
        // Must be within bounds
        if (!SpatialSystem.isWithinBounds(state, pos)) return false;
        // Must be walkable
        if (!UnifiedTileService.isWalkable(state, pos)) return false;
        // Must not have an actor
        if (getActorAt(state, pos)) return false;
        return true;
    });
}

export const KINETIC_TRI_TRAP: SkillDefinition = {
    id: 'KINETIC_TRI_TRAP',
    name: 'Kinetic Tri-Trap',
    description: 'Deploy 3 hidden traps on axial tiles. Triggered enemies are flung away.',
    slot: 'defensive',
    icon: '🪤',
    baseVariables: {
        range: TRAP_RANGE,
        cost: 0,
        cooldown: SKILL_COOLDOWN,
    },
    execute: (state: GameState, attacker: Actor, _target?: Point, activeUpgrades: string[] = []) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        let currentState = state;
        const hasVolatileCore = activeUpgrades.includes('VOLATILE_CORE');
        const hasChainReaction = activeUpgrades.includes('TRAP_CHAIN_REACTION') || activeUpgrades.includes('CHAIN_REACTION');
        const hasQuickReload = activeUpgrades.includes('QUICK_RELOAD');

        // Get valid trap positions
        const validPositions = getValidTrapPositions(state, attacker.position, TRAP_RANGE);

        if (validPositions.length === 0) {
            return { effects, messages: ['No valid trap positions!'], consumesTurn: false };
        }

        // Select random positions (up to TRAP_COUNT, or fewer if not enough tiles)
        const trapCount = Math.min(TRAP_COUNT, validPositions.length);
        const selectedPositions: Point[] = [];

        // 1. CLEAR OLD TRAPS from this owner
        effects.push({ type: 'RemoveTrap', position: { q: 0, r: 0, s: 0 }, ownerId: attacker.id });

        const availablePositions = [...validPositions];

        for (let i = 0; i < trapCount; i++) {
            if (availablePositions.length === 0) break;

            // Use RNG for deterministic selection
            const { value, nextState } = consumeRandom(currentState);
            currentState = nextState;

            const idx = Math.floor(value * availablePositions.length) % availablePositions.length;
            selectedPositions.push(availablePositions[idx]);
            availablePositions.splice(idx, 1);
        }

        // Place traps
        for (const pos of selectedPositions) {
            effects.push({
                type: 'PlaceTrap',
                position: pos,
                ownerId: attacker.id,
                volatileCore: hasVolatileCore,
                chainReaction: hasChainReaction,
                resetCooldown: hasQuickReload ? 1 : TRAP_RESET_CD
            });
            effects.push({
                type: 'Juice',
                effect: 'flash',
                target: pos,
                intensity: 'low',
                color: '#ffaa00'
            });
        }

        messages.push(`${selectedPositions.length} traps deployed.`);

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (_state: GameState, origin: Point) => {
        // This skill doesn't require target selection - traps are auto-placed
        // Return empty to indicate it's a self-cast skill
        return [origin];
    },
    upgrades: {
        VOLATILE_CORE: {
            id: 'VOLATILE_CORE',
            name: 'Volatile Core',
            description: 'Traps deal 1 damage when triggered.',
        },
        TRAP_CHAIN_REACTION: {
            id: 'TRAP_CHAIN_REACTION',
            name: 'Chain Reaction',
            description: 'When a trap triggers, adjacent traps also activate.',
        },
        QUICK_RELOAD: {
            id: 'QUICK_RELOAD',
            name: 'Quick Reload',
            description: 'Individual trap reset cooldown reduced to 1.',
        },
    },
    scenarios: getSkillScenarios('KINETIC_TRI_TRAP'),
};

/**
 * Calculate fling destination from trap position
 * Pushes outward from the trap (away from trap center)
 */
export function calculateTrapFlingDestination(
    state: GameState,
    triggerPos: Point,
    trapPos: Point,
    magnitude: number
): Point {
    // Direction from trap to triggered position (outward)
    const dq = triggerPos.q - trapPos.q;
    const dr = triggerPos.r - trapPos.r;
    // const ds = triggerPos.s - trapPos.s; // unused

    // Normalize to get direction
    let dirIdx = 0;
    if (dq > 0 && dr === 0) dirIdx = 0;
    else if (dq > 0 && dr < 0) dirIdx = 1;
    else if (dq === 0 && dr < 0) dirIdx = 2;
    else if (dq < 0 && dr === 0) dirIdx = 3;
    else if (dq < 0 && dr > 0) dirIdx = 4;
    else dirIdx = 5;

    const dirVec = hexDirection(dirIdx);

    // Calculate destination
    let dest = triggerPos;
    for (let i = 0; i < magnitude; i++) {
        const next = hexAdd(dest, dirVec);
        // Stop at walls
        if (!SpatialSystem.isWithinBounds(state, next) || !UnifiedTileService.isWalkable(state, next)) {
            break;
        }
        dest = next;
    }

    return dest;
}

// Export constants for use in effect-engine
export { FLING_MAGNITUDE, TRAP_RESET_CD };
