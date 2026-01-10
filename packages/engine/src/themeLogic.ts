import type { GameState, AtomicEffect } from './types';
import { hexEquals, getDirectionFromTo, hexAdd, hexDirection } from './hex';
import { isWalkable, isOccupied } from './helpers';

/**
 * THEME LOGIC INTERCEPTORS
 * Implements "Slippery" and "Void" mechanics using the effect middleware pattern.
 */

/**
 * Slippery Interceptor:
 * If a Displacement effect ends on a slippery tile, it evaluates if sliding is possible.
 */
export const slipperyInterceptor = (
    effect: AtomicEffect,
    state: GameState,
    context: { targetId?: string; sourceId?: string }
): AtomicEffect | AtomicEffect[] | null => {
    if (effect.type !== 'Displacement') return effect;

    const dest = effect.destination;
    const isSlippery = state.slipperyPositions?.some(p => hexEquals(p, dest));

    if (!isSlippery) return effect;

    // We need to know the direction of movement to slide
    const source = effect.source || (effect.target === 'self' ? state.player.position : state.enemies.find(e => e.id === context.targetId)?.position);

    if (!source) return effect;

    const dirIdx = getDirectionFromTo(source, dest);
    if (dirIdx === -1) return effect; // No clear direction (e.g. teleport)

    const slideDir = hexDirection(dirIdx);
    const slideDest = hexAdd(dest, slideDir);

    // Check if slide destination is valid
    if (isWalkable(slideDest, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight) && !isOccupied(slideDest, state)) {
        // Return two effects: the original move AND a follow-up displacement
        // Actually, to make it feel like "one move", we could just change the destination,
        // but for VFX (sliding), having two distinct displacements might be better.
        // However, the interceptor pattern usually returns a modified effect or the same.
        // If we want a cascade, we can recurse here.

        const nextSlide = {
            type: 'Displacement' as const,
            target: effect.target,
            destination: slideDest,
            source: dest
        };

        // Recurse to handle chain sliding
        const recursiveResult = slipperyInterceptor(nextSlide, state, context);

        if (Array.isArray(recursiveResult)) {
            return [effect, ...recursiveResult];
        } else if (recursiveResult) {
            return [effect, recursiveResult];
        }
    }

    return effect;
};

/**
 * Void Interceptor:
 * If an actor ends on a Void tile, they lose 1 Max HP.
 */
export const voidInterceptor = (
    effect: AtomicEffect,
    state: GameState
): AtomicEffect | AtomicEffect[] | null => {
    if (effect.type !== 'Displacement') return effect;

    const dest = effect.destination;
    const isVoid = state.voidPositions?.some(p => hexEquals(p, dest));

    if (!isVoid) return effect;

    const damageEffect: AtomicEffect = {
        type: 'Damage',
        target: effect.target === 'self' ? 'targetActor' : 'targetActor', // context will handle targetId
        amount: 1
    };

    const messageEffect: AtomicEffect = {
        type: 'Message',
        text: 'The Void consumes your soul!'
    };

    // Note: Void tiles are intended to reduce MAX HP in the roadmap.
    // For now we'll do standard damage or we could add a MaxHp reduction effect.

    return [effect, damageEffect, messageEffect];
};

/**
 * Compose all theme interceptors
 */
export const themeInterceptors = (
    effect: AtomicEffect,
    state: GameState,
    context: { targetId?: string; sourceId?: string }
): AtomicEffect[] => {
    let effects: AtomicEffect[] = [effect];

    // Apply Slippery (Recursive)
    const slipperyRes = slipperyInterceptor(effect, state, context);
    if (Array.isArray(slipperyRes)) {
        effects = slipperyRes;
    } else if (slipperyRes) {
        effects = [slipperyRes];
    }

    // Apply Void to all displacements in the chain
    const finalEffects: AtomicEffect[] = [];
    for (const eff of effects) {
        const voidRes = voidInterceptor(eff, state);
        if (Array.isArray(voidRes)) {
            finalEffects.push(...voidRes);
        } else if (voidRes) {
            finalEffects.push(voidRes);
        }
    }

    return finalEffects;
};
