import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByActor } from '../systems/validation';
import {
    resolveRuntimeMovementExecutionPlan,
    resolveRuntimeReachableMovementTargets
} from '../systems/skill-runtime/movement';
import type { SkillRuntimeDefinition } from '../systems/skill-runtime/types';

const BASIC_MOVE_RUNTIME: SkillRuntimeDefinition = {
    id: 'BASIC_MOVE',
    name: 'Walk',
    description: 'Move to an adjacent or nearby tile within your speed range.',
    slot: 'passive',
    icon: '👣',
    keywords: ['MOVEMENT', 'TRAVEL'],
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0
    },
    targeting: {
        generator: 'movement_reachable',
        range: 1,
        deterministicSort: 'distance_then_q_then_r'
    },
    movementPolicy: {
        rangeSource: 'actor_speed',
        freeMoveRangeOverride: 20
    },
    combatScript: [],
    upgrades: {},
    compiledFrom: 'json',
    sourcePath: 'src/skills/basic_move.ts'
};

export const BASIC_MOVE: SkillDefinition = {
    id: 'BASIC_MOVE',
    name: 'Walk',
    description: 'Move to an adjacent or nearby tile within your speed range.',
    slot: 'passive',
    icon: '👣',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const movementPlan = resolveRuntimeMovementExecutionPlan(BASIC_MOVE_RUNTIME, state, attacker, target);
        const validTargets = resolveRuntimeReachableMovementTargets(BASIC_MOVE_RUNTIME, state, attacker);
        const isTargetValid = validTargets.some(point =>
            point.q === target.q && point.r === target.r && point.s === target.s
        );

        if (!movementPlan || !isTargetValid || !movementPlan.path || movementPlan.path.length < 2) {
            messages.push('Target out of reach or blocked!');
            return { effects, messages, consumesTurn: false };
        }

        if (movementPlan.interruptionMessage) {
            messages.push(movementPlan.interruptionMessage);
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: movementPlan.destination,
            source: attacker.position,
            path: movementPlan.path,
            simulatePath: movementPlan.movementPolicy.simulatePath,
            ignoreCollision: true,
            ignoreWalls: movementPlan.movementPolicy.ignoreWalls,
            ignoreGroundHazards: movementPlan.movementPolicy.ignoreGroundHazards
                || movementPlan.movementPolicy.pathing === 'flight'
                || movementPlan.movementPolicy.pathing === 'teleport',
            presentationKind: 'walk',
            pathStyle: 'hex_step',
            presentationSequenceId: `${attacker.id}:BASIC_MOVE:${movementPlan.destination.q},${movementPlan.destination.r},${movementPlan.destination.s}:${state.turnNumber}`
        });

        const actorLabel = attacker.id === state.player.id
            ? 'You'
            : `${attacker.subtype || 'enemy'}#${attacker.id}`;
        messages.push(`${actorLabel} moved to (${movementPlan.destination.q}, ${movementPlan.destination.r}). [Range ${movementPlan.range}]`);

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor;
        if (!actor) return [];

        const movementTargets = resolveRuntimeReachableMovementTargets(BASIC_MOVE_RUNTIME, state, actor, origin);
        return movementTargets.filter(point => !isBlockedByActor(state, point, actor.id));
    },
    upgrades: {},
    scenarios: getSkillScenarios('BASIC_MOVE')
};
