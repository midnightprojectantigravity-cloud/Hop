import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/SpatialSystem';
import { getSkillScenarios } from '../scenarios';
import { canLandOnHazard, isBlockedByActor } from '../systems/validation';
import { UnifiedTileService } from '../systems/unified-tile-service';

/**
 * BASIC_MOVE Skill
 * Goal: Standard movement skill that uses BFS for pathfinding.
 */

// 1. Extract the shared logic
const getEffectiveMoveRange = (state: GameState, actor: Actor): number => {
    const hostileCount = state.enemies.filter(e => e.hp > 0 && e.factionId === 'enemy').length;
    if (hostileCount === 0) return 20;
    return Math.max(actor.speed || 1, 1);
};

const isBlockedMovementTile = (state: GameState, target: Point): boolean => {
    if (!SpatialSystem.isWithinBounds(state, target)) return true;
    const traits = UnifiedTileService.getTraitsAt(state, target);
    return traits.has('BLOCKS_MOVEMENT');
};

export const BASIC_MOVE: SkillDefinition = {
    id: 'BASIC_MOVE',
    name: 'Walk',
    description: 'Move to an adjacent or nearby tile within your speed range.',
    slot: 'passive',
    icon: '👣',
    baseVariables: {
        range: 1, // Base range, will be modified by actor speed
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const range = getEffectiveMoveRange(state, attacker);
        const validTargets = SpatialSystem.getMovementRange(state, attacker.position, range);

        const isTargetValid = validTargets.some((p: Point) => hexEquals(p, target));
        const isHazardAdjacentLanding =
            hexDistance(attacker.position, target) === 1 &&
            canLandOnHazard(state, attacker, target) &&
            !isBlockedMovementTile(state, target) &&
            !isBlockedByActor(state, target, attacker.id);

        if (!isTargetValid && !isHazardAdjacentLanding) {
            messages.push('Target out of reach or blocked!');
            return { effects, messages, consumesTurn: false };
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            source: attacker.position,
            simulatePath: true
        });

        messages.push(`Moved (Range: ${range}).`);

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor;
        if (!actor) return [];

        const range = getEffectiveMoveRange(state, actor);
        const movementTargets = SpatialSystem.getMovementRange(state, origin, range);
        const hazardNeighbors = getNeighbors(origin).filter(p =>
            canLandOnHazard(state, actor, p) &&
            !isBlockedMovementTile(state, p) &&
            !isBlockedByActor(state, p, actor.id)
        );
        return [...movementTargets, ...hazardNeighbors.filter(h => !movementTargets.some(m => hexEquals(m, h)))];
    },
    upgrades: {},
    scenarios: getSkillScenarios('BASIC_MOVE')
};
