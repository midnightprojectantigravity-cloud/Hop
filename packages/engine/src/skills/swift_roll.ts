import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { canLandOnHazard, isBlockedByWall, isBlockedByActor, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/spatial-system';
import { resolveMovementCapabilities } from '../systems/capabilities/movement';

/**
 * SWIFT_ROLL Skill
 * 2-hex repositioning.
 */
export const SWIFT_ROLL: SkillDefinition = {
    id: 'SWIFT_ROLL',
    name: 'Swift Roll',
    description: 'Quickly dodge 2 tiles. Passive: Automatically roll away from attackers when hit.',
    slot: 'utility',
    icon: '🤸',
    baseVariables: {
        range: 2,
        cost: 0,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };
        const movementModel = resolveMovementCapabilities(state, attacker, { skillId: 'SWIFT_ROLL', target }).model;
        const range = Math.max(2 + (movementModel.rangeModifier || 0), 1);

        if (!validateRange(attacker.position, target, range)) {
            return { effects, messages: ['Too far!'], consumesTurn: false };
        }

        if (
            (!movementModel.ignoreWalls && isBlockedByWall(state, target))
            || !canLandOnHazard(state, attacker, target, { movementModel })
            || isBlockedByActor(state, target, attacker.id)
        ) {
            return { effects, messages: ['Cannot roll there!'], consumesTurn: false };
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            simulatePath: movementModel.pathing !== 'teleport',
            ignoreGroundHazards: movementModel.ignoreGroundHazards || movementModel.pathing === 'flight' || movementModel.pathing === 'teleport'
        });
        effects.push({
            type: 'Juice',
            effect: 'dashBlur',
            target: target,
            path: [attacker.position, target],
            metadata: {
                signature: 'MOVE.DASH.NEUTRAL.SWIFT_ROLL',
                family: 'movement',
                primitive: 'dash',
                phase: 'travel',
                element: 'neutral',
                variant: 'swift_roll',
                sourceRef: { kind: 'source_hex' },
                targetRef: { kind: 'target_hex' },
                skillId: 'SWIFT_ROLL'
            }
        });

        messages.push("Swift roll!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor | undefined;
        if (!actor) return [];
        const movementModel = resolveMovementCapabilities(state, actor, { skillId: 'SWIFT_ROLL' }).model;
        const range = Math.max(2 + (movementModel.rangeModifier || 0), 1);
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return (
                (movementModel.ignoreWalls || !isBlockedByWall(state, p))
                && canLandOnHazard(state, actor, p, { movementModel })
                && !isBlockedByActor(state, p)
            );
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('SWIFT_ROLL')
};
