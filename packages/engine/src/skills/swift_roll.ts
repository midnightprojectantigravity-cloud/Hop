import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/spatial-system';
import {
    resolveSkillMovementPolicy,
    validateMovementDestination
} from '../systems/capabilities/movement-policy';

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
        const movementPolicy = resolveSkillMovementPolicy(state, attacker, {
            skillId: 'SWIFT_ROLL',
            target,
            baseRange: 2
        });
        const { range } = movementPolicy;

        if (!validateRange(attacker.position, target, range)) {
            return { effects, messages: ['Too far!'], consumesTurn: false };
        }

        const destination = validateMovementDestination(state, attacker, target, movementPolicy);
        if (!destination.isValid) {
            return { effects, messages: ['Cannot roll there!'], consumesTurn: false };
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            simulatePath: movementPolicy.simulatePath,
            ignoreWalls: movementPolicy.ignoreWalls,
            ignoreGroundHazards: movementPolicy.ignoreGroundHazards
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
        const movementPolicy = resolveSkillMovementPolicy(state, actor, {
            skillId: 'SWIFT_ROLL',
            baseRange: 2
        });
        const { range } = movementPolicy;
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return validateMovementDestination(state, actor, p, movementPolicy).isValid;
        });
    },
    upgrades: {},
};
