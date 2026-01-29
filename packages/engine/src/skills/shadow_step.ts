import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByWall, isBlockedByLava, isBlockedByActor, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';

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

        if (!validateRange(attacker.position, target, 2)) {
            return { effects, messages: ['Too far!'], consumesTurn: false };
        }

        if (isBlockedByWall(state, target) || isBlockedByLava(state, target) || isBlockedByActor(state, target, attacker.id)) {
            return { effects, messages: ['Cannot step there!'], consumesTurn: false };
        }

        // Teleport + Stealth Extension
        effects.push({ type: 'Displacement', target: 'self', destination: target });
        effects.push({ type: 'SetStealth', target: 'self', amount: 2 });
        effects.push({ type: 'Juice', effect: 'hiddenFade', target });

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

        const range = 2;
        return SpatialSystem.getAreaTargets(state, origin, range).filter(p => {
            if (hexEquals(p, origin)) return false;
            return !isBlockedByWall(state, p) && !isBlockedByLava(state, p) && !isBlockedByActor(state, p);
        });
    },
    upgrades: {},
    scenarios: getSkillScenarios('SHADOW_STEP')
};
