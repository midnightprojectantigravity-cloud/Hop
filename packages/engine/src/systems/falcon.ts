/**
 * FALCON COMPANION SYSTEM
 * 
 * The Falcon is a semi-autonomous companion for the Hunter archetype.
 * - Stats: Move 3 | Range 2 | Weight Light | Flying
 * - Acts immediately after the Player turn
 * - Tethered Spirit: At 0 HP, removed. Skill CD (3 turns). Auto-revives adjacent to Hunter.
 */

import type { Actor, GameState, Point, AtomicEffect } from '../types';
import { hexEquals, getNeighbors, hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from './SpatialSystem';
import { UnifiedTileService } from './unified-tile-service';
import { applyEffects } from './effect-engine';
import { SkillRegistry } from '../skillRegistry';
import { createFalcon as createFalconEntity } from './entity-factory';
import { appendTaggedMessage, tagMessage } from './engine-messages';

// ============================================================================
// FALCON STATS
// ============================================================================

export const FALCON_STATS = {
    move: 3,
    attackRange: 2,
    apexStrikeRange: 4,
    weightClass: 'Light' as const,
    basicPeckDamage: 1,
    apexStrikeDamage: 40,
    apexStrikeCooldown: 2,
    revivalCooldown: 3,
};

/**
 * Spawn Falcon adjacent to Hunter
 */
export function spawnFalcon(state: GameState, hunterId: string): { state: GameState; falcon: Actor | null } {
    const hunter = hunterId === state.player.id ? state.player : state.enemies.find(e => e.id === hunterId);
    if (!hunter) return { state, falcon: null };

    // Find valid spawn position adjacent to Hunter
    const neighbors = getNeighbors(hunter.position);
    const validSpawn = neighbors.find(n =>
        SpatialSystem.isWithinBounds(state, n) &&
        UnifiedTileService.isWalkable(state, n) &&
        !getActorAt(state, n)
    );

    if (!validSpawn) return { state, falcon: null };

    const falcon = createFalconEntity({ ownerId: hunterId, position: validSpawn });

    return {
        state: {
            ...state,
            enemies: [...state.enemies, falcon],
        },
        falcon,
    };
}

/**
 * Remove Falcon and start revival countdown
 */
export function removeFalcon(state: GameState, falconId: string): GameState {
    const falcon = state.enemies.find(e => e.id === falconId);
    if (!falcon || !falcon.companionOf) return state;

    // Find the Hunter and set revival cooldown on their state
    // We track this on the Hunter's companionState indirectly through a status effect
    // or we can add a field to track "companion revival CD"

    return {
        ...state,
        enemies: state.enemies.filter(e => e.id !== falconId),
        message: appendTaggedMessage(state.message, 'The Falcon falls but will return!', 'INFO', 'AI'),
    };
}

/**
 * Revive Falcon adjacent to Hunter after cooldown expires
 */
export function reviveFalcon(state: GameState, hunterId: string): { state: GameState; falcon: Actor | null } {
    // Check if Falcon already exists
    const existingFalcon = state.enemies.find(e => e.companionOf === hunterId && e.subtype === 'falcon');
    if (existingFalcon) return { state, falcon: existingFalcon };

    const result = spawnFalcon(state, hunterId);
    if (result.falcon) {
        result.state.message = appendTaggedMessage(result.state.message, 'The Falcon returns!', 'INFO', 'AI');
    }
    return result;
}

// ============================================================================
// FALCON MODE MANAGEMENT
// ============================================================================

/**
 * Update Falcon's mode and mark target
 */
export function updateFalconMode(
    state: GameState,
    falconId: string,
    mode: 'scout' | 'predator' | 'roost',
    markTarget?: Point | string
): GameState {
    return {
        ...state,
        enemies: state.enemies.map(e => {
            if (e.id !== falconId) return e;
            return {
                ...e,
                companionState: {
                    ...e.companionState,
                    mode,
                    markTarget,
                    orbitStep: mode === 'scout' ? 0 : e.companionState?.orbitStep,
                },
            };
        }),
    };
}

/**
 * Get Falcon for a specific Hunter
 */
export function getFalconForHunter(state: GameState, hunterId: string): Actor | undefined {
    return state.enemies.find(e => e.companionOf === hunterId && e.subtype === 'falcon');
}

// ============================================================================
// TARGETING SELECTOR
// ============================================================================

/**
 * Pure Targeting Selector: Returns valid target based on mode and radius.
 * Separates "Finding" from "Executing".
 */
export function findFalconTarget(state: GameState, falcon: Actor): Actor | Point | undefined {
    const mode = falcon.companionState?.mode;
    const mark = falcon.companionState?.markTarget;

    if (mode === 'predator' && typeof mark === 'string') {
        const victim = state.enemies.find(e => e.id === mark && e.hp > 0);
        return victim;
    }

    if (mode === 'scout' && typeof mark === 'object') {
        return mark as Point;
    }

    if (mode === 'roost') {
        const hunterId = falcon.companionOf;
        if (!hunterId) return undefined;
        return hunterId === state.player.id ? state.player : state.enemies.find(e => e.id === hunterId);
    }

    return undefined;
}

// ============================================================================
// FALCON AI BEHAVIORS
// ============================================================================



/**
 * Find nearest enemy in range for Basic Peck
 */
function findNearestEnemyInRange(state: GameState, falconPos: Point, range: number): Actor | undefined {
    const hostileEnemies = state.enemies.filter(e =>
        e.factionId === 'enemy' &&
        e.hp > 0 &&
        hexDistance(falconPos, e.position) <= range
    );

    if (hostileEnemies.length === 0) return undefined;

    return hostileEnemies.sort((a, b) =>
        hexDistance(falconPos, a.position) - hexDistance(falconPos, b.position)
    )[0];
}

/**
 * Calculate path toward target respecting move limit
 */
function calculateMoveToward(state: GameState, from: Point, to: Point, maxMove: number): Point {
    const dist = hexDistance(from, to);
    if (dist <= maxMove) {
        // Can reach directly, check if walkable
        if (UnifiedTileService.isWalkable(state, to) && !getActorAt(state, to)) {
            return to;
        }
    }

    // Simple greedy pathfinding: Move in direction that minimizes distance
    const neighbors = getNeighbors(from);
    let bestPos = from;
    let bestDist = dist;

    for (const n of neighbors) {
        if (!SpatialSystem.isWithinBounds(state, n)) continue;
        if (!UnifiedTileService.isWalkable(state, n)) continue;
        if (getActorAt(state, n)) continue;

        const nDist = hexDistance(n, to);
        if (nDist < bestDist) {
            bestDist = nDist;
            bestPos = n;
        }
    }

    return bestPos;
}

/**
 * Execute Scout mode behavior: Orbit marked tile, peck nearby enemies
 */
export function executeScoutBehavior(
    state: GameState,
    falcon: Actor
): { effects: AtomicEffect[]; newPosition: Point; messages: string[] } {
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];

    const markTarget = falcon.companionState?.markTarget;
    if (!markTarget || typeof markTarget !== 'object') {
        // No valid mark, idle
        return { effects, newPosition: falcon.position, messages };
    }

    // const markPos = markTarget as Point;
    // const orbitStep = falcon.companionState?.orbitStep ?? 0;

    // 1. ACTION PRIORITY: Check for enemies in range for Basic Peck
    const nearestEnemy = findNearestEnemyInRange(state, falcon.position, 1);
    if (nearestEnemy) {
        const result = SkillRegistry.FALCON_PECK.execute(state, falcon, nearestEnemy.position);
        if (result.consumesTurn) {
            return { effects: result.effects, newPosition: falcon.position, messages: result.messages };
        }
    }

    // 2. MOVEMENT: Use FALCON_SCOUT skill
    const scoutResult = SkillRegistry.FALCON_SCOUT.execute(state, falcon);
    if (scoutResult.consumesTurn) {
        return { effects: scoutResult.effects, newPosition: falcon.position, messages: scoutResult.messages };
    }

    return { effects, newPosition: falcon.position, messages };
}

/**
 * Execute Predator mode behavior: Pursue and engage marked enemy
 */
export function executePredatorBehavior(
    state: GameState,
    falcon: Actor
): { effects: AtomicEffect[]; newPosition: Point; messages: string[] } {
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];

    const markTarget = falcon.companionState?.markTarget;
    if (!markTarget || typeof markTarget === 'object') {
        // No valid enemy mark, revert to roost
        return { effects, newPosition: falcon.position, messages: [tagMessage('Falcon returns to Hunter.', 'INFO', 'AI')] };
    }

    const targetEnemy = findFalconTarget(state, falcon) as Actor;

    if (!targetEnemy || targetEnemy.hp <= 0) {
        // Target dead or lost, return to hunter
        effects.push({
            type: 'UpdateCompanionState',
            target: falcon.id,
            mode: 'roost',
        });
        return { effects, newPosition: falcon.position, messages: [tagMessage('Target lost. Falcon returns to roost.', 'INFO', 'AI')] };
    }

    const dist = hexDistance(falcon.position, targetEnemy.position);

    // 1. ACTION PRIORITY: APEX STRIKE
    if (dist <= FALCON_STATS.apexStrikeRange) {
        const result = SkillRegistry.FALCON_APEX_STRIKE.execute(state, falcon, targetEnemy.position);
        if (result.consumesTurn) {
            return { effects: result.effects, newPosition: falcon.position, messages: result.messages };
        }
    }

    // 2. ACTION PRIORITY: BASIC PECK
    if (dist <= FALCON_STATS.attackRange) {
        const result = SkillRegistry.FALCON_PECK.execute(state, falcon, targetEnemy.position);
        if (result.consumesTurn) {
            return { effects: result.effects, newPosition: falcon.position, messages: result.messages };
        }
    }

    // 3. MOVEMENT: Move toward target
    const targetPos = calculateMoveToward(state, falcon.position, targetEnemy.position, FALCON_STATS.move);
    if (!hexEquals(targetPos, falcon.position)) {
        const moveResult = SkillRegistry.BASIC_MOVE.execute(state, falcon, targetPos);
        return { effects: moveResult.effects, newPosition: targetPos, messages: moveResult.messages };
    }

    return { effects, newPosition: falcon.position, messages };
}

/**
 * Execute Roost mode behavior: Return to Hunter, heal on arrival
 */
export function executeRoostBehavior(
    state: GameState,
    falcon: Actor
): { effects: AtomicEffect[]; newPosition: Point; messages: string[] } {
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];

    const hunterId = falcon.companionOf;
    if (!hunterId) {
        return { effects, newPosition: falcon.position, messages };
    }

    const hunter = hunterId === state.player.id ? state.player : state.enemies.find(e => e.id === hunterId);
    if (!hunter) {
        return { effects, newPosition: falcon.position, messages };
    }

    const hunterPos = hunter.position;
    const dist = hexDistance(falcon.position, hunterPos);

    // 1. ACTION PRIORITY: HEAL
    if (dist <= 1) {
        const result = SkillRegistry.FALCON_HEAL.execute(state, falcon, hunterPos);
        if (result.consumesTurn) {
            return { effects: result.effects, newPosition: falcon.position, messages: result.messages };
        }
    }

    // 2. MOVEMENT: Move toward Hunter
    const targetPos = calculateMoveToward(state, falcon.position, hunterPos, FALCON_STATS.move);
    if (!hexEquals(targetPos, falcon.position)) {
        const moveResult = SkillRegistry.BASIC_MOVE.execute(state, falcon, targetPos);
        return { effects: moveResult.effects, newPosition: targetPos, messages: moveResult.messages };
    }

    return { effects, newPosition: falcon.position, messages };
}

/**
 * Main turn entry point for the Falcon companion
 */
export function resolveFalconTurn(state: GameState, falcon: Actor): { state: GameState; messages: string[] } {
    const mode = falcon.companionState?.mode || 'roost';
    let result: { effects: AtomicEffect[]; newPosition: Point; messages: string[] };

    if (mode === 'scout') result = executeScoutBehavior(state, falcon);
    else if (mode === 'predator') result = executePredatorBehavior(state, falcon);
    else result = executeRoostBehavior(state, falcon);

    let nextState = state;

    // 1. Process movement if changed
    if (!hexEquals(result.newPosition, falcon.position)) {
        const moveEff: AtomicEffect = {
            type: 'Displacement',
            target: falcon.id,
            destination: result.newPosition,
            source: falcon.position
        };
        nextState = applyEffects(nextState, [moveEff], { targetId: falcon.id });
    }

    // 2. Process side-effects (Damage/Heal/Juice)
    if (result.effects.length > 0) {
        nextState = applyEffects(nextState, result.effects, {
            targetId: falcon.companionOf,
            sourceId: falcon.id
        });
    }

    // 3. Sync messages directly (applyEffects handles Message effects but behaviors return strings)
    // messages are already handled by combat.ts calling push(...result.messages)

    return { state: nextState, messages: result.messages };
}
