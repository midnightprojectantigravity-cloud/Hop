import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { getMovementRange } from '../systems/spatial';

/**
 * BASIC_MOVE Skill
 * Goal: Standard movement skill that uses BFS for pathfinding.
 */
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

        const movePoints = Math.max(attacker.speed || 1, 1);
        const validTargets = getMovementRange(state, attacker.position, movePoints);

        const isTargetValid = validTargets.some((p: Point) => hexEquals(p, target));

        if (!isTargetValid) {
            messages.push('Target out of reach or blocked!');
            return { effects, messages, consumesTurn: false };
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            source: attacker.position
        });

        messages.push('Moved.');

        return { effects, messages };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Find the actor at origin to get their speed
        const actor = getActorAt(state, origin) as Actor;
        if (!actor) return [];
        return getMovementRange(state, origin, Math.max(actor.speed || 1, 1));
    },
    upgrades: {},
    scenarios: []
};
