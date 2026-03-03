import type { GameState, AtomicEffect } from '../../types';
import { pointToKey } from '../../hex';
import { TileResolver } from './tile-effects';
import { applyEffects } from '../effect-engine';

/**
 * TILE TICK SYSTEM
 * 
 * Manages the passage of time for tile-based effects.
 */

export function tickTileEffects(state: GameState): { state: GameState, messages: string[] } {
    let curState = state;
    const messages: string[] = [];
    const allEffects: AtomicEffect[] = [];
    const actors = [curState.player, ...curState.enemies];
    const actorsByTile = new Map<string, typeof actors>();
    for (const actor of actors) {
        const key = pointToKey(actor.position);
        const bucket = actorsByTile.get(key);
        if (bucket) bucket.push(actor);
        else actorsByTile.set(key, [actor]);
    }

    // 1. Process Duration Decay & Hooks
    const nextTiles = new Map(curState.tiles);

    for (const [key, tile] of nextTiles.entries()) {
        const effectsToKeep = [];
        let tileModified = false;

        for (const effectState of tile.effects) {
            // Permanent effects satisfy duration === -1
            if (effectState.duration === -1) {
                effectsToKeep.push(effectState);
                continue;
            }

            // Decrement duration
            const nextDuration = effectState.duration - 1;

            if (nextDuration > 0) {
                effectsToKeep.push({ ...effectState, duration: nextDuration });
                tileModified = true;
            } else {
                // Effect expired
                messages.push(`The ${effectState.id.toLowerCase()} died down.`);
                tileModified = true;
                // Optional: onRemove hook could go here
            }
        }

        if (tileModified) {
            nextTiles.set(key, { ...tile, effects: effectsToKeep });
        }

        // Preserve historical tile-first ordering while avoiding tile x actor scans.
        const tileActors = actorsByTile.get(key);
        if (!tileActors || tileActors.length === 0) continue;
        for (const actor of tileActors) {
            const stayResult = TileResolver.processStay(actor, tile, curState);
            allEffects.push(...stayResult.effects);
            messages.push(...stayResult.messages);
        }
    }

    curState = { ...curState, tiles: nextTiles };

    // 3. Apply all generated effects (Damage, etc.)
    if (allEffects.length > 0) {
        curState = applyEffects(curState, allEffects);
    }

    return { state: curState, messages };
}
