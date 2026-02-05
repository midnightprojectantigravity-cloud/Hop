import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/SpatialSystem';
import { getSkillScenarios } from '../scenarios';

/**
 * BASIC_MOVE Skill
 * Goal: Standard movement skill that uses BFS for pathfinding.
 */

// 1. Extract the shared logic
const getEffectiveMoveRange = (state: GameState, actor: Actor): number => {
    const noEnemies = state.enemies.filter(e => e.hp > 0).length === 0;
    if (noEnemies) return 20;
    return Math.max(actor.speed || 1, 1);
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

        if (!isTargetValid) {
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
        return SpatialSystem.getMovementRange(state, origin, range);
    },
    upgrades: {},
    scenarios: getSkillScenarios('BASIC_MOVE')
};
