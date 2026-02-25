import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByWall, isBlockedByLava, isBlockedByActor, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';

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

        if (!validateRange(attacker.position, target, 2)) {
            return { effects, messages: ['Too far!'], consumesTurn: false };
        }

        if (isBlockedByWall(state, target) || isBlockedByLava(state, target) || isBlockedByActor(state, target, attacker.id)) {
            return { effects, messages: ['Cannot roll there!'], consumesTurn: false };
        }

        effects.push({ type: 'Displacement', target: 'self', destination: target });
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
        const range = 2;
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return !isBlockedByWall(state, p) && !isBlockedByLava(state, p) && !isBlockedByActor(state, p);
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('SWIFT_ROLL')
};
