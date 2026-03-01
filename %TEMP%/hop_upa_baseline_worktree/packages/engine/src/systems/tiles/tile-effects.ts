import type { GameState, Actor, Point } from '../../types';
import type { Tile, TileHookResult, TileHookContext, TileEffectState } from './tile-types';
import { TILE_EFFECTS } from './tile-registry';
import type { TileEffectID } from '../../types/registry';
import { getNeighbors, hexEquals } from '../../hex';
import { UnifiedTileService } from './unified-tile-service';
import { createTileAilmentInjectionEffects, isAcaeEnabled } from '../ailments/runtime';

/**
 * TILE EFFECTS SYSTEM
 * 
 * Centralized Resolver that handles the lifecycle of tiles and their effects.
 */

export class TileResolver {
    private static hasFireProtection(actor: Actor): boolean {
        return actor.statusEffects.some(s => s.type === 'fire_immunity')
            || actor.activeSkills?.some(s => s.id === 'ABSORB_FIRE')
            || false;
    }

    private static isFireHazard(tile: Tile, traits: Set<string>): boolean {
        return tile.baseId === 'LAVA' || traits.has('LAVA') || traits.has('FIRE');
    }

    private static appendAcaeTileInjection(
        combinedResult: TileHookResult,
        state: GameState,
        actor: Actor,
        tileKind: 'lava' | 'fire' | 'wet' | 'miasma' | 'ice',
        intensity: 'pass' | 'enter' | 'stay',
        message?: string
    ): void {
        const effects = createTileAilmentInjectionEffects(state, actor, tileKind, intensity);
        if (effects.length === 0) return;
        this.mergeResults(combinedResult, {
            effects,
            messages: message ? [message] : []
        });
    }

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

        const traits = UnifiedTileService.getTraitsForTile(state, tile);
        const acaeEnabled = isAcaeEnabled(state);
        let appliedHeatInjection = false;

        if (traits.has('HAZARDOUS') && !actor.isFlying) {
            const fireProtected = this.isFireHazard(tile, traits) && this.hasFireProtection(actor);
            if (acaeEnabled && this.isFireHazard(tile, traits) && !fireProtected) {
                this.appendAcaeTileInjection(
                    combinedResult,
                    state,
                    actor,
                    tile.baseId === 'LAVA' || traits.has('LAVA') ? 'lava' : 'fire',
                    'enter',
                    tile.baseId === 'LAVA' || traits.has('LAVA') ? 'Lava scorches you.' : 'Flames lick at your armor.'
                );
                appliedHeatInjection = true;
            } else if (fireProtected) {
                // Fire-immune actors should not be intercepted/killed by fire hazard entry.
                // Damage conversion/healing is handled downstream by Damage resolution.
            } else {
                const damage = 99;
                if (tile.baseId === 'LAVA' || traits.has('LAVA')) {
                    this.mergeResults(combinedResult, {
                        effects: [
                            { type: 'Damage', target: actor.id, amount: damage, reason: 'lava_sink' },
                            { type: 'Juice', effect: 'lavaSink', target: actor.position }
                        ],
                        messages: [`Lava Sink! You were engulfed by lava!`],
                        interrupt: true
                    });
                } else if (tile.baseId === 'VOID' || traits.has('VOID')) {
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
        }

        if (acaeEnabled && !actor.isFlying) {
            if (tile.baseId === 'ICE') {
                this.appendAcaeTileInjection(combinedResult, state, actor, 'ice', 'enter');
            }
            for (const effectState of tile.effects) {
                if (effectState.id === 'WET') {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'wet', 'enter');
                } else if (effectState.id === 'MIASMA') {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'miasma', 'enter');
                } else if (effectState.id === 'FIRE' && !appliedHeatInjection) {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'fire', 'enter');
                    appliedHeatInjection = true;
                }
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
    static processTransition(actor: Actor, tile: Tile, state: GameState, momentum?: number, options: { ignoreActors?: boolean, ignoreGroundHazards?: boolean } = {}): TileHookResult {
        const { ignoreActors = false, ignoreGroundHazards = false } = options;
        const combinedResult: TileHookResult = {
            effects: [],
            messages: [],
            newMomentum: momentum !== undefined ? Math.max(0, momentum - 1) : undefined,
            interrupt: false
        };

        const traits = UnifiedTileService.getTraitsForTile(state, tile);
        const acaeEnabled = isAcaeEnabled(state);
        let appliedHeatInjection = false;

        // 1. Physical Collision (Wall/Environment)
        if (traits.has('BLOCKS_MOVEMENT')) {
            combinedResult.interrupt = true;
            combinedResult.newMomentum = 0;
            return combinedResult;
        }

        // 2. Physical Collision (Other Actors)
        // We use isOccupied which checks the mask. 
        // Note: During a slide, we might need a more refined check if the mask hasn't been refreshed yet, 
        // but for now, this ensures units don't phase through each other in multi-unit pulses.
        if (!ignoreActors) {
            const currentOccupant = state.enemies.find(e => e.id !== actor.id && e.hp > 0 && hexEquals(e.position, tile.position))
                || (actor.id !== state.player.id && hexEquals(state.player.position, tile.position) ? state.player : undefined);

            if (currentOccupant) {
                combinedResult.interrupt = true;
                combinedResult.newMomentum = 0;
                return combinedResult;
            }
        }

        const context: TileHookContext = {
            tile,
            actor,
            state,
            momentum,
            isFinalDestination: false,
            source: actor.previousPosition
        };

        // 1. Process Base Traits
        if (traits.has('HAZARDOUS') && !actor.isFlying && !ignoreGroundHazards) {
            const fireProtected = this.isFireHazard(tile, traits) && this.hasFireProtection(actor);
            if (acaeEnabled && this.isFireHazard(tile, traits) && !fireProtected) {
                this.appendAcaeTileInjection(
                    combinedResult,
                    state,
                    actor,
                    tile.baseId === 'LAVA' || traits.has('LAVA') ? 'lava' : 'fire',
                    'pass'
                );
                appliedHeatInjection = true;
            } else if (fireProtected) {
                // Preserve absorb-fire contract: fire still applies its payload, but never interrupts movement.
                this.mergeResults(combinedResult, {
                    effects: [
                        { type: 'Damage', target: actor.id, amount: 99, reason: 'hazard_intercept' }
                    ],
                    messages: ['Flames surge through you.'],
                    interrupt: false
                });
            } else {
                // LETHAL HAZARD: Intercept and kill immediately
                const damage = 99;

                this.mergeResults(combinedResult, {
                    effects: [
                        { type: 'Damage', target: actor.id, amount: damage, reason: 'hazard_intercept' },
                        { type: 'Juice', effect: 'lavaSink', target: tile.position }
                    ],
                    messages: [(tile.baseId === 'LAVA' || traits.has('LAVA')) ? 'Sunk in Lava!' : 'Consumed by Void!'],
                    interrupt: true
                });
            }
        } else if (traits.has('SLIPPERY')) {
            combinedResult.newMomentum = Math.max(1, (momentum || 0));
        } else if (traits.has('LIQUID')) {
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

        // 3. Trap Trigger Check (Kinetic Tri-Trap)
        if (!combinedResult.interrupt && !actor.isFlying && !ignoreGroundHazards && state.traps) {
            const trapAtPos = state.traps.find(t =>
                hexEquals(t.position, tile.position) &&
                t.cooldown === 0 &&
                t.ownerId !== actor.id // Don't trigger on owner
            );

            if (trapAtPos) {
                // Calculate fling destination (outward from trap)
                const dq = tile.position.q - trapAtPos.position.q || 1;
                const dr = tile.position.r - trapAtPos.position.r || 0;

                // Determine direction index
                let dirIdx = 0;
                if (dq > 0 && dr === 0) dirIdx = 0;
                else if (dq > 0 && dr < 0) dirIdx = 1;
                else if (dq === 0 && dr < 0) dirIdx = 2;
                else if (dq < 0 && dr === 0) dirIdx = 3;
                else if (dq < 0 && dr > 0) dirIdx = 4;
                else dirIdx = 5;

                // Calculate destination (magnitude 3)
                const FLING_MAGNITUDE = 3;
                let dest = tile.position;
                const hexDirection = (dir: number) => {
                    const directions = [
                        { q: 1, r: 0, s: -1 },
                        { q: 1, r: -1, s: 0 },
                        { q: 0, r: -1, s: 1 },
                        { q: -1, r: 0, s: 1 },
                        { q: -1, r: 1, s: 0 },
                        { q: 0, r: 1, s: -1 }
                    ];
                    return directions[dir % 6];
                };
                const dir = hexDirection(dirIdx);

                for (let i = 0; i < FLING_MAGNITUDE; i++) {
                    const next = { q: dest.q + dir.q, r: dest.r + dir.r, s: dest.s + dir.s };
                    if (!UnifiedTileService.isWalkable(state, next)) break;
                    dest = next;
                }

                this.mergeResults(combinedResult, {
                    effects: [
                        {
                            type: 'SetTrapCooldown',
                            position: trapAtPos.position,
                            ownerId: trapAtPos.ownerId,
                            cooldown: trapAtPos.resetCooldown ?? 2
                        },
                        {
                            type: 'Displacement',
                            target: actor.id,
                            destination: dest,
                            source: tile.position,
                            isFling: true
                        },
                        { type: 'Juice', effect: 'kineticWave', target: tile.position, intensity: 'high' },
                        { type: 'Juice', effect: 'combat_text', target: tile.position, text: 'TRAP!' }
                    ],
                    messages: [`${actor.subtype || 'Unit'} triggered a kinetic trap!`],
                    interrupt: true
                });

                if (trapAtPos.volatileCore) {
                    this.mergeResults(combinedResult, {
                        effects: [{ type: 'Damage', target: actor.id, amount: 1, reason: 'trap_volatile_core' }],
                        messages: ['Volatile core detonates!']
                    });
                }

                if (trapAtPos.chainReaction && state.traps) {
                    const adjacentTriggered = state.traps.filter(t =>
                        t.ownerId === trapAtPos.ownerId &&
                        t.cooldown === 0 &&
                        !hexEquals(t.position, trapAtPos.position) &&
                        getNeighbors(trapAtPos.position).some(n => hexEquals(n, t.position))
                    );

                    for (const chained of adjacentTriggered) {
                        this.mergeResults(combinedResult, {
                            effects: [{
                                type: 'SetTrapCooldown',
                                position: chained.position,
                                ownerId: chained.ownerId,
                                cooldown: chained.resetCooldown ?? 2
                            }],
                            messages: ['Chain reaction sparks nearby traps!']
                        });
                        if (chained.volatileCore) {
                            this.mergeResults(combinedResult, {
                                effects: [{ type: 'Damage', target: actor.id, amount: 1, reason: 'trap_chain_volatile' }],
                                messages: ['Chain blast!']
                            });
                        }
                    }
                }
            }
        }

        if (acaeEnabled && !actor.isFlying && !ignoreGroundHazards) {
            if (tile.baseId === 'ICE') {
                this.appendAcaeTileInjection(combinedResult, state, actor, 'ice', 'pass');
            }
            for (const effectState of tile.effects) {
                if (effectState.id === 'WET') {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'wet', 'pass');
                } else if (effectState.id === 'MIASMA') {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'miasma', 'pass');
                } else if (effectState.id === 'FIRE' && !appliedHeatInjection) {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'fire', 'pass');
                    appliedHeatInjection = true;
                }
            }
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

        const traits = UnifiedTileService.getTraitsForTile(state, tile);
        const acaeEnabled = isAcaeEnabled(state);

        // Traits
        if ((tile.baseId === 'LAVA' || traits.has('LAVA')) && !actor.isFlying && !actor.statusEffects.some(s => s.type === 'fire_immunity')) {
            if (acaeEnabled) {
                this.appendAcaeTileInjection(combinedResult, state, actor, 'lava', 'stay', 'Molten heat builds up.');
            } else {
                const isPlayer = actor.id === 'player';
                this.mergeResults(combinedResult, {
                    effects: [{ type: 'Damage', target: actor.id, amount: isPlayer ? 1 : 99, reason: 'lava_tick' }],
                    messages: [`Lava Sink! You were engulfed by lava!`] // Standard message
                });
            }
        }

        if (acaeEnabled && !actor.isFlying) {
            if (tile.baseId === 'ICE') {
                this.appendAcaeTileInjection(combinedResult, state, actor, 'ice', 'stay');
            }
            for (const effectState of tile.effects) {
                if (effectState.id === 'WET') {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'wet', 'stay');
                } else if (effectState.id === 'MIASMA') {
                    this.appendAcaeTileInjection(combinedResult, state, actor, 'miasma', 'stay');
                }
            }
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
     * @param momentum Initial movement energy
     * @param options Transition options (ignoreActors, ignoreGroundHazards)
     */
    static processPath(actor: Actor, path: Point[], state: GameState, momentum?: number, options: { ignoreActors?: boolean, ignoreGroundHazards?: boolean } = {}): {
        lastValidPos: Point,
        result: TileHookResult,
        interrupt: boolean
    } {
        let currentPos = actor.position;
        let currentMomentum = momentum;
        let totalResult: TileHookResult = { effects: [], messages: [], newMomentum: momentum, interrupt: false };

        for (const nextPoint of path) {
            const tile = UnifiedTileService.getTileAt(state, nextPoint);
            const traits = UnifiedTileService.getTraitsForTile(state, tile);

            const stepResult = this.processTransition(actor, tile, state, currentMomentum, options);

            // WALLS/BLOCKING: Stop BEFORE entering
            if (stepResult.interrupt && traits.has('BLOCKS_MOVEMENT')) {
                totalResult.interrupt = true;
                break;
            }

            // Otherwise, we "enter" the tile (even if we die there)
            currentPos = nextPoint;
            this.mergeResults(totalResult, stepResult);

            if (totalResult.interrupt) {
                totalResult.interrupt = true;
                break;
            }

            currentMomentum = totalResult.newMomentum;

            if (currentMomentum !== undefined && currentMomentum <= 0) {
                break;
            }
        }

        return {
            lastValidPos: currentPos,
            result: totalResult,
            interrupt: !!totalResult.interrupt
        };
    }

    /**
     * Utility to get movement cost for AI
     */
    static getMovementCost(state: GameState, tile: Tile): number {
        const traits = UnifiedTileService.getTraitsForTile(state, tile);
        let cost = 1;
        if (traits.has('HAZARDOUS')) cost += 5;
        if (traits.has('LIQUID')) cost += 1;
        if (traits.has('FIRE')) cost += 2;
        return cost;
    }
}
