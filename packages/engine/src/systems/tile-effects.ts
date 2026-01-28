import type { GameState, Actor } from '../types';
import type { Tile, TileHookResult, TileHookContext, TileEffectState } from './tile-types';
import { TILE_EFFECTS } from './tile-registry';

/**
 * TILE EFFECTS SYSTEM
 * 
 * Centralized Resolver that handles the lifecycle of tiles and their effects.
 */

export class TileResolver {
    /**
     * Merge multiple TileHookResults into one
     */
    private static mergeResults(target: TileHookResult, source: TileHookResult): void {
        target.effects.push(...source.effects);
        target.messages.push(...source.messages);
        if (source.newMomentum !== undefined) {
            target.newMomentum = source.newMomentum;
        }
        if (source.interrupt) {
            target.interrupt = true;
        }
        if (source.modifyTile) {
            target.modifyTile = { ...target.modifyTile, ...source.modifyTile };
        }
    }

    /**
     * Process tile entry (unit lands on tile)
     */
    static processEntry(actor: Actor, tile: Tile, state: GameState): TileHookResult {
        const combinedResult: TileHookResult = {
            effects: [],
            messages: [],
            interrupt: false
        };

        const context: TileHookContext = {
            tile,
            actor,
            state,
            isFinalDestination: true,
            source: actor.previousPosition
        };

        // 1. Process Base Traits
        if (tile.traits.has('HAZARDOUS')) {
            const isPlayer = actor.id === 'player';
            if (tile.baseId === 'LAVA') {
                this.mergeResults(combinedResult, {
                    effects: [
                        { type: 'Damage', target: actor.id, amount: isPlayer ? 1 : 99, reason: 'lava_sink' },
                        { type: 'Juice', effect: 'lavaSink', target: actor.position }
                    ],
                    messages: [`Lava Sink! You were engulfed by lava!`], // Keyword for Scenario
                    interrupt: true
                });
            } else if (tile.baseId === 'VOID') {
                this.mergeResults(combinedResult, {
                    effects: [
                        { type: 'Damage', target: actor.id, amount: isPlayer ? 1 : 99, reason: 'void_sink' },
                        { type: 'Juice', effect: 'lavaSink', target: actor.position }
                    ],
                    messages: [`Void consumes your soul!`], // Keyword for Scenario
                    interrupt: true
                });
            }
        }

        // 2. Process Active Effects
        for (const effectState of tile.effects) {
            const effectDef = TILE_EFFECTS[effectState.id];
            if (!effectDef?.onEnter) continue;

            const result = effectDef.onEnter(context);
            this.mergeResults(combinedResult, result);
            if (combinedResult.interrupt) break;
        }

        // Final Robust Message Filter (Safety)
        if (combinedResult.messages.length === 0 && combinedResult.effects.some(e => e.type === 'LavaSink')) {
            combinedResult.messages.push('Lava Sink! You were engulfed by lava!');
        }

        return combinedResult;
    }

    /**
     * Process tile transition (unit passes through)
     */
    static processTransition(actor: Actor, tile: Tile, state: GameState, momentum?: number): TileHookResult {
        const combinedResult: TileHookResult = {
            effects: [],
            messages: [],
            newMomentum: momentum,
            interrupt: false
        };

        const context: TileHookContext = {
            tile,
            actor,
            state,
            momentum,
            isFinalDestination: false,
            source: actor.previousPosition
        };

        // 1. Process Base Traits
        if (tile.traits.has('SLIPPERY')) {
            combinedResult.newMomentum = momentum;
        } else if (tile.traits.has('LIQUID')) {
            if (momentum !== undefined) {
                combinedResult.newMomentum = Math.max(0, momentum - 1);
            }
        }

        // 2. Process Active Effects
        for (const effectState of tile.effects) {
            const effectDef = TILE_EFFECTS[effectState.id];
            if (!effectDef?.onPass) continue;

            const result = effectDef.onPass(context);
            this.mergeResults(combinedResult, result);
            if (combinedResult.interrupt) break;
        }

        return combinedResult;
    }

    /**
     * Process tile stay (turn ends while on tile)
     */
    static processStay(actor: Actor, tile: Tile, state: GameState): TileHookResult {
        const combinedResult: TileHookResult = {
            effects: [],
            messages: []
        };

        const context: TileHookContext = {
            tile,
            actor,
            state,
            isFinalDestination: false
        };

        // Traits
        if (tile.baseId === 'LAVA' && !actor.statusEffects.some(s => s.type === 'fire_immunity')) {
            const isPlayer = actor.id === 'player';
            this.mergeResults(combinedResult, {
                effects: [{ type: 'Damage', target: actor.id, amount: isPlayer ? 1 : 99, reason: 'lava_tick' }],
                messages: [`Lava Sink! You were engulfed by lava!`] // Standard message
            });
        }

        for (const effectState of tile.effects) {
            const effectDef = TILE_EFFECTS[effectState.id];
            if (!effectDef?.onStay) continue;

            const result = effectDef.onStay(context);
            this.mergeResults(combinedResult, result);
        }

        return combinedResult;
    }

    /**
     * Apply an effect to a tile, handling interactions
     */
    static applyEffect(tile: Tile, effectId: string, duration: number, potency: number, state: GameState, sourceId?: string): TileHookResult {
        const effectDef = TILE_EFFECTS[effectId];
        if (!effectDef) return { effects: [], messages: [] };

        const combinedResult: TileHookResult = {
            effects: [],
            messages: []
        };

        for (const existing of tile.effects) {
            const interaction = effectDef.interactsWith?.[existing.id];
            if (interaction) {
                const result = interaction({ tile, state, potency, sourceId });
                this.mergeResults(combinedResult, result);
                return combinedResult;
            }
        }

        if (effectDef.onApply) {
            const result = effectDef.onApply({ tile, state, potency, sourceId });
            this.mergeResults(combinedResult, result);
        }

        if (!combinedResult.modifyTile?.effects) {
            tile.effects.push({ id: effectId, duration, potency, sourceId });
        } else if (combinedResult.modifyTile) {
            tile.effects = combinedResult.modifyTile.effects as TileEffectState[];
        }

        return combinedResult;
    }

    /**
     * Utility to get movement cost for AI
     */
    static getMovementCost(tile: Tile): number {
        let cost = 1;
        if (tile.traits.has('HAZARDOUS')) cost += 5;
        if (tile.traits.has('LIQUID')) cost += 1;
        if (tile.effects.some(e => e.id === 'FIRE')) cost += 2;
        return cost;
    }
}
