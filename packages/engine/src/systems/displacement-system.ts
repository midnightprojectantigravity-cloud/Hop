import type { AtomicEffect, GameState, Point, Actor } from '../types';
import { hexDistance, hexDirection, getDirectionFromTo } from '../hex';
import { processKineticPulse } from './kinetic-kernel';

/**
 * PULL_TOWARD
 * High-level maneuver to drag a target toward a shooter.
 * Starts AT the target position.
 */
export function pullToward(state: GameState, shooter: Actor, targetPos: Point, momentum: number): AtomicEffect[] {
    const dist = hexDistance(shooter.position, targetPos);
    if (dist <= 1) return [];

    const dirIdx = getDirectionFromTo(targetPos, shooter.position);
    const dir = hexDirection(dirIdx);

    return processKineticPulse(state, {
        origin: targetPos,
        direction: dir,
        momentum: Math.min(momentum, dist - 1)
    });
}

/**
 * SWAP
 * Instantaneous swap of two actors.
 */
export function swap(actorA: Actor, actorB: Actor): AtomicEffect[] {
    return [
        { type: 'Displacement', target: actorA.id, destination: actorB.position },
        { type: 'Displacement', target: actorB.id, destination: actorA.position }
    ];
}

/**
 * KINETIC_FLING
 * Momentum injection starting AT the victim.
 */
export function kineticFling(state: GameState, victimPos: Point, direction: Point, momentum: number): AtomicEffect[] {
    return processKineticPulse(state, {
        origin: victimPos,
        direction,
        momentum
    });
}

/**
 * DID_UNIT_SUNK_OR_DIED
 * Helper to check if a specific target was removed via LavaSink or died from Impact.
 */
export function didUnitSunkOrDied(effects: AtomicEffect[], target: Actor): boolean {
    const sank = effects.some(e => e.type === 'LavaSink' && (e as any).target === target.id);
    const died = effects.some(e => e.type === 'Impact' && (e as any).target === target.id && (e as any).damage >= (target as any).hp);
    return sank || died;
}
