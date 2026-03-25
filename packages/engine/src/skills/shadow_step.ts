import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/spatial-system';
import {
    resolveSkillMovementPolicy,
    validateMovementDestination
} from '../systems/capabilities/movement-policy';

/**
 * SHADOW_STEP Skill
 * Range 2 Teleport.
 * Only works if stealthed.
 * Adds +2 to stealthCounter.
 */
export const SHADOW_STEP: SkillDefinition = {
    id: 'SHADOW_STEP',
    name: 'Shadow Step',
    description: 'Teleport through the shadows. Only works while invisible. Extends stealth.',
    slot: 'utility',
    icon: '👤✨',
    baseVariables: {
        range: 2,
        cost: 0,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const isStealthed = (attacker.stealthCounter || 0) > 0;
        if (!isStealthed) {
            return { effects, messages: ['Must be invisible to Shadow Step!'], consumesTurn: false };
        }

        const movementPolicy = resolveSkillMovementPolicy(state, attacker, {
            skillId: 'SHADOW_STEP',
            target,
            baseRange: 2,
            basePathing: 'teleport'
        });
        if (!validateRange(attacker.position, target, movementPolicy.range)) {
            return { effects, messages: ['Too far!'], consumesTurn: false };
        }

        const destination = validateMovementDestination(state, attacker, target, movementPolicy);
        if (!destination.isValid) {
            return { effects, messages: ['Cannot step there!'], consumesTurn: false };
        }

        // Teleport + Stealth Extension
        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            simulatePath: movementPolicy.simulatePath,
            ignoreWalls: movementPolicy.ignoreWalls,
            ignoreGroundHazards: movementPolicy.ignoreGroundHazards,
            presentationKind: 'teleport',
            pathStyle: 'blink',
            presentationSequenceId: `${attacker.id}:SHADOW_STEP:${target.q},${target.r},${target.s}:${state.turnNumber}`
        });
        effects.push({ type: 'SetStealth', target: 'self', amount: 2 });
        effects.push({
            type: 'Juice',
            effect: 'hiddenFade',
            target,
            metadata: {
                signature: 'MOVE.BLINK.SHADOW.SHADOW_STEP',
                family: 'movement',
                primitive: 'blink',
                phase: 'instant',
                element: 'shadow',
                variant: 'shadow_step_arrival',
                targetRef: { kind: 'target_hex' },
                skillId: 'SHADOW_STEP'
            }
        });

        messages.push("Shadow stepped!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const isStealthed = (state.player.stealthCounter || 0) > 0;
        if (!isStealthed) return [];

        const movementPolicy = resolveSkillMovementPolicy(state, state.player, {
            skillId: 'SHADOW_STEP',
            baseRange: 2,
            basePathing: 'teleport'
        });
        const range = movementPolicy.range;
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return validateMovementDestination(state, state.player, p, movementPolicy).isValid;
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('SHADOW_STEP')
};
