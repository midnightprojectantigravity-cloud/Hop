import type { GameState, Actor, Point } from '../types';
import type { Tile, TileHookResult, TileHookContext, TileEffectState } from './tile-types';
import { TILE_EFFECTS } from './tile-registry';
import type { TileEffectID } from '../types/registry';
import { pointToKey } from '../hex';

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

        if (tile.traits.has('HAZARDOUS')) {
            const damage = 99;
            if (tile.baseId === 'LAVA') {
                this.mergeResults(combinedResult, {
                    effects: [
                        { type: 'Damage', target: actor.id, amount: damage, reason: 'lava_sink' },
                        { type: 'Juice', effect: 'lavaSink', target: actor.position }
                    ],
                    messages: [`Lava Sink! You were engulfed by lava!`],
                    interrupt: true
                });
            } else if (tile.baseId === 'VOID') {
                this.mergeResults(combinedResult, {
                    effects: [
                        { type: 'Damage', target: actor.id, amount: damage, reason: 'void_sink' },
                        { type: 'Juice', effect: 'lavaSink', target: actor.position } // Visual reuse
                    ],
                    messages: [`Void consumes your soul!`],
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
            newMomentum: 0, // Default: Non-special tiles stop momentum
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
        if (tile.traits.has('HAZARDOUS')) {
            // LETHAL HAZARD: Intercept and kill immediately
            const damage = 99;

            this.mergeResults(combinedResult, {
                effects: [
                    { type: 'Damage', target: actor.id, amount: damage, reason: 'hazard_intercept' },
                    { type: 'Juice', effect: 'lavaSink', target: tile.position }
                ],
                messages: [tile.baseId === 'LAVA' ? 'Sunk in Lava!' : 'Consumed by Void!'],
                interrupt: true
            });
        } else if (tile.traits.has('SLIPPERY')) {
            combinedResult.newMomentum = Math.max(1, (momentum || 0));
        } else if (tile.traits.has('LIQUID')) {
            if (momentum !== undefined && momentum > 0) {
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
    static applyEffect(tile: Tile, effectId: TileEffectID, duration: number, potency: number, state: GameState, sourceId?: string): TileHookResult {
        const effectDef = TILE_EFFECTS[effectId];
        if (!effectDef) return { effects: [], messages: [] };

        const combinedResult: TileHookResult = {
            effects: [],
            messages: []
        };

        for (const existing of tile.effects) {
            const interaction = effectDef.interactsWith?.[existing.id as TileEffectID];
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
     * processPath
     * Evaluates a movement path hex-by-hex to check for interrupts/hazards.
     */
    static processPath(actor: Actor, path: Point[], state: GameState, momentum?: number): {
        interruptedAt?: Point,
        lastValidPos: Point,
        result: TileHookResult
    } {
        const combinedResult: TileHookResult = { effects: [], messages: [], interrupt: false, newMomentum: momentum };
        let lastValidPos = actor.position;

        for (const pos of path) {
            const tile = state.tiles.get(pointToKey(pos));
            if (!tile) {
                lastValidPos = pos;
                continue;
            }

            const stepResult = this.processTransition(actor, tile, state, combinedResult.newMomentum);
            this.mergeResults(combinedResult, stepResult);

            if (combinedResult.interrupt) {
                return { interruptedAt: pos, lastValidPos, result: combinedResult };
            }

            lastValidPos = pos;
            if (combinedResult.newMomentum !== undefined) {
                // If momentum hits zero, stop here
                if (combinedResult.newMomentum <= 0) break;
            }
        }

        return { lastValidPos, result: combinedResult };
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
