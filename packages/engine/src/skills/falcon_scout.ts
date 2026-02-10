import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals, getNeighbors, hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/SpatialSystem';
import { UnifiedTileService } from '../systems/unified-tile-service';

/**
 * FALCON_SCOUT Skill
 * 
 * Logic for autonomous patrolling/orbiting a target point.
 * Moves the actor 1 hex clockwise around the markTarget.
 */
export const FALCON_SCOUT: SkillDefinition = {
    id: 'FALCON_SCOUT' as any, // Will be registered in registry.ts
    name: 'Scout Orbit',
    description: 'The actor orbits a target point in a hexagonal ring.',
    slot: 'passive',
    icon: '👁️',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        const markTarget = attacker.companionState?.markTarget;
        if (!markTarget || typeof markTarget !== 'object') {
            return { effects, messages, consumesTurn: false };
        }

        const markPos = markTarget as Point;

        // 1. Calculate next orbit position
        const orbitPositions = getNeighbors(markPos);

        let nextOrbitPos: Point;

        // If we are not on the orbit ring, move to the nearest point on it
        if (hexDistance(attacker.position, markPos) !== 1) {
            nextOrbitPos = orbitPositions.sort((a, b) =>
                hexDistance(attacker.position, a) - hexDistance(attacker.position, b)
            )[0];
        } else {
            // Find current index in orbit
            const currentIdx = orbitPositions.findIndex(p => hexEquals(p, attacker.position));
            // Rotate clockwise (next index)
            const nextIdx = (currentIdx + 1) % 6;
            nextOrbitPos = orbitPositions[nextIdx];
        }

        // 2. Validate move
        if (SpatialSystem.isWithinBounds(state, nextOrbitPos) &&
            UnifiedTileService.isWalkable(state, nextOrbitPos) &&
            !getActorAt(state, nextOrbitPos)) {

            effects.push({
                type: 'Displacement',
                target: attacker.id,
                destination: nextOrbitPos,
                source: attacker.position,
                simulatePath: true,
            });

            // Update orbit step if needed (though we calculate based on position now)
            return { effects, messages, consumesTurn: true };
        }

        return { effects, messages, consumesTurn: false };
    },
    upgrades: {},
    getValidTargets: (_state: GameState, _origin: Point) => {
        return []; // Autonomous skill, no manual targeting usually
    },
};
