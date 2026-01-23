import type { GameState, Point, AtomicEffect, Actor } from '../types';
import { hexEquals } from '../hex';

/**
 * TILE EFFECTS SYSTEM
 * 
 * Architecture: Observer-Based Tile Logic
 * 
 * Instead of actions triggering effects on tiles, tiles observe units and trigger
 * effects when units interact with them. This ensures consistent behavior regardless
 * of how a unit arrives at a tile (walking, pushing, dashing, grappling, etc.).
 * 
 * Key Concepts:
 * - onPass: Triggered when a unit moves THROUGH a tile (mid-movement)
 * - onEnter: Triggered when a unit's movement TERMINATES on a tile
 * - Momentum Modification: Tiles can affect kinetic momentum during movement
 */

/**
 * Context provided to tile effect handlers
 */
export interface TileEffectContext {
    /** The actor interacting with the tile */
    actor: Actor;
    /** Current game state */
    state: GameState;
    /** Current momentum (for kinetic movements) */
    momentum?: number;
    /** Whether this is the final destination */
    isFinalDestination: boolean;
    /** The source of the movement (for tracking) */
    source?: Point;
}

/**
 * Result from a tile effect handler
 */
export interface TileEffectResult {
    /** Effects to apply immediately */
    effects: AtomicEffect[];
    /** Messages to display */
    messages: string[];
    /** Modified momentum (if applicable) */
    newMomentum?: number;
    /** Whether to interrupt the movement chain */
    interrupt?: boolean;
}

/**
 * Tile Effect Definition
 * 
 * Tiles are now "active observers" that monitor units passing through or landing on them.
 */
export interface TileEffect {
    /** Unique identifier for this effect type */
    id: string;
    /** Display name */
    name: string;
    /** Description of the effect */
    description: string;

    /**
     * Triggered when a unit moves THROUGH this tile (not stopping)
     * Use this for:
     * - Momentum modification (friction, slipperiness)
     * - Damage during transit
     * - Status application during movement
     */
    onPass?: (context: TileEffectContext) => TileEffectResult;

    /**
     * Triggered when a unit's movement TERMINATES on this tile
     * Use this for:
     * - Landing damage
     * - Status application on arrival
     * - Tile state changes
     */
    onEnter?: (context: TileEffectContext) => TileEffectResult;

    /**
     * Optional: Check if this effect applies to a given position
     * Useful for dynamic effects or conditional application
     */
    appliesTo?: (position: Point, state: GameState) => boolean;
}

/**
 * Registry of all tile effects in the game
 */
export const TILE_EFFECT_REGISTRY: Record<string, TileEffect> = {};

/**
 * Register a tile effect
 */
export function registerTileEffect(effect: TileEffect): void {
    TILE_EFFECT_REGISTRY[effect.id] = effect;
}

/**
 * Get all tile effects that apply to a given position
 */
export function getTileEffectsAt(position: Point, state: GameState): TileEffect[] {
    const effects: TileEffect[] = [];

    for (const effect of Object.values(TILE_EFFECT_REGISTRY)) {
        if (!effect.appliesTo || effect.appliesTo(position, state)) {
            effects.push(effect);
        }
    }

    return effects;
}

/**
 * Process tile effects when a unit passes through a tile
 */
export function processTilePass(
    position: Point,
    actor: Actor,
    state: GameState,
    momentum?: number
): TileEffectResult {
    const tileEffects = getTileEffectsAt(position, state);

    const combinedResult: TileEffectResult = {
        effects: [],
        messages: [],
        newMomentum: momentum,
        interrupt: false
    };

    for (const effect of tileEffects) {
        if (!effect.onPass) continue;

        const result = effect.onPass({
            actor,
            state,
            momentum: combinedResult.newMomentum,
            isFinalDestination: false,
            source: actor.previousPosition
        });

        // Accumulate effects and messages
        combinedResult.effects.push(...result.effects);
        combinedResult.messages.push(...result.messages);

        // Update momentum if modified
        if (result.newMomentum !== undefined) {
            combinedResult.newMomentum = result.newMomentum;
        }

        // Check for interruption
        if (result.interrupt) {
            combinedResult.interrupt = true;
            break; // Stop processing further effects if interrupted
        }
    }

    return combinedResult;
}

/**
 * Process tile effects when a unit enters (lands on) a tile
 */
export function processTileEnter(
    position: Point,
    actor: Actor,
    state: GameState
): TileEffectResult {
    const tileEffects = getTileEffectsAt(position, state);

    const combinedResult: TileEffectResult = {
        effects: [],
        messages: [],
        interrupt: false
    };

    for (const effect of tileEffects) {
        if (!effect.onEnter) continue;

        const result = effect.onEnter({
            actor,
            state,
            isFinalDestination: true,
            source: actor.previousPosition
        });

        // Accumulate effects and messages
        combinedResult.effects.push(...result.effects);
        combinedResult.messages.push(...result.messages);

        // Check for interruption
        if (result.interrupt) {
            combinedResult.interrupt = true;
            break;
        }
    }

    return combinedResult;
}

// ============================================================================
// BUILT-IN TILE EFFECTS
// ============================================================================

/**
 * LAVA SINK
 * 
 * The classic hazard. Units that pass through or land on lava take massive damage.
 * Lava also reduces momentum, creating a "viscosity" effect.
 */
export const LAVA_SINK_EFFECT: TileEffect = {
    id: 'lava_sink',
    name: 'Lava Sink',
    description: 'Molten lava that damages and slows units',

    appliesTo: (position: Point, state: GameState) => {
        return state.lavaPositions.some(lp => hexEquals(lp, position));
    },

    onPass: (context: TileEffectContext) => {
        const { actor, momentum } = context;

        return {
            effects: [
                { type: 'Damage', target: actor.id, amount: 5, reason: 'lava_pass' },
                { type: 'Juice', effect: 'combat_text', target: actor.position, text: 'Sizzle!' }
            ],
            messages: [`${actor.id} passes through lava!`],
            // Lava reduces momentum by 2 (friction/viscosity)
            newMomentum: momentum !== undefined ? Math.max(0, momentum - 2) : undefined
        };
    },

    onEnter: (context: TileEffectContext) => {
        const { actor } = context;
        const isPlayer = actor.type === 'player';

        return {
            effects: [
                { type: 'Damage', target: actor.id, amount: 999, reason: 'lava_sink' },
                { type: 'ApplyStatus', target: actor.id, status: 'stunned', duration: 1 },
                { type: 'Juice', effect: 'lavaSink', target: actor.position }
            ],
            messages: [`${isPlayer ? 'You sink' : actor.subtype + ' sinks'} into the lava!`],
            interrupt: true // Movement chain breaks when landing in lava
        };
    }
};

/**
 * ICE (SLIPPERY)
 * 
 * Ice tiles don't reduce momentum - they preserve it!
 * Units slide further than intended.
 */
export const ICE_EFFECT: TileEffect = {
    id: 'ice',
    name: 'Ice',
    description: 'Slippery ice that preserves momentum',

    appliesTo: (position: Point, state: GameState) => {
        return state.slipperyPositions?.some(sp => hexEquals(sp, position)) || false;
    },

    onPass: (context: TileEffectContext) => {
        const { actor, momentum } = context;

        return {
            effects: [
                { type: 'Juice', effect: 'combat_text', target: actor.position, text: 'Slide!' }
            ],
            messages: [],
            // Ice doesn't reduce momentum at all (no friction)
            newMomentum: momentum
        };
    },

    onEnter: (context: TileEffectContext) => {
        const { actor, source, state } = context;
        const effects: AtomicEffect[] = [
            { type: 'Juice', effect: 'flash', target: actor.position }
        ];

        // Calculate slide direction from source to current position
        if (source) {
            const dq = actor.position.q - source.q;
            const dr = actor.position.r - source.r;
            const ds = actor.position.s - source.s;

            // Slide one more hex in the same direction
            const slideDestination = {
                q: actor.position.q + dq,
                r: actor.position.r + dr,
                s: actor.position.s + ds
            };

            // Check if slide destination is walkable
            const isWall = state.wallPositions.some(w =>
                w.q === slideDestination.q && w.r === slideDestination.r && w.s === slideDestination.s
            );
            const isLava = state.lavaPositions.some(l =>
                l.q === slideDestination.q && l.r === slideDestination.r && l.s === slideDestination.s
            );
            const inBounds = slideDestination.q >= 0 && slideDestination.q < state.gridWidth &&
                slideDestination.r >= 0 && slideDestination.r < state.gridHeight;

            if (inBounds && !isWall && !isLava) {
                effects.push({
                    type: 'Displacement',
                    target: actor.id,
                    destination: slideDestination
                });
            }
        }

        return {
            effects,
            messages: [`${actor.id} slides on ice!`]
        };
    }
};

/**
 * VOID
 * 
 * The void consumes all who enter.
 */
export const VOID_EFFECT: TileEffect = {
    id: 'void',
    name: 'Void',
    description: 'The endless void consumes all',

    appliesTo: (position: Point, state: GameState) => {
        return state.voidPositions?.some(vp => hexEquals(vp, position)) || false;
    },

    onPass: (context: TileEffectContext) => {
        const { actor } = context;

        return {
            effects: [
                { type: 'Damage', target: actor.id, amount: 10, reason: 'void_pass' }
            ],
            messages: [`${actor.id} grazes the void!`],
            newMomentum: context.momentum !== undefined ? Math.max(0, context.momentum - 3) : undefined
        };
    },

    onEnter: (context: TileEffectContext) => {
        const { actor } = context;
        const isPlayer = actor.type === 'player';
        const damage = isPlayer ? 1 : 999; // Players take 1 damage, enemies die

        return {
            effects: [
                { type: 'Damage', target: actor.id, amount: damage, reason: 'void_consume' },
                { type: 'Juice', effect: 'flash', target: actor.position }
            ],
            messages: [`${isPlayer ? 'Void consumes you' : 'Void consumes ' + actor.subtype}!`],
            interrupt: !isPlayer // Only interrupt for enemies
        };
    }
};

/**
 * SNARE TRAP
 * 
 * Snares stop all momentum and stun the unit.
 */
export const SNARE_TRAP_EFFECT: TileEffect = {
    id: 'snare_trap',
    name: 'Snare Trap',
    description: 'A trap that stops movement and stuns',

    // Note: Snares would need to be tracked in GameState
    // For now, this is a template
    appliesTo: (position: Point, state: GameState) => {
        // TODO: Add snarePositions to GameState
        return false;
    },

    onPass: (context: TileEffectContext) => {
        const { actor } = context;

        return {
            effects: [
                { type: 'ApplyStatus', target: actor.id, status: 'stunned', duration: 1 },
                { type: 'Juice', effect: 'shake', intensity: 'medium' },
                { type: 'Juice', effect: 'combat_text', target: actor.position, text: 'SNAP!' }
            ],
            messages: [`${actor.id} triggered a snare trap!`],
            newMomentum: 0, // Snare stops all momentum
            interrupt: true
        };
    }
};

// Register all built-in effects
registerTileEffect(LAVA_SINK_EFFECT);
registerTileEffect(ICE_EFFECT);
registerTileEffect(VOID_EFFECT);
registerTileEffect(SNARE_TRAP_EFFECT);
