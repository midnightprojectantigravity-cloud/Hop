import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getSkillScenarios } from '../scenarios';

/**
 * SMOKE_SCREEN Skill
 * Adds +2 to stealthCounter.
 */
export const SMOKE_SCREEN: SkillDefinition = {
    id: 'SMOKE_SCREEN',
    name: 'Smoke Screen',
    description: 'Vanish into a cloud of smoke. Adds +2 to stealth counter.',
    slot: 'utility',
    icon: '💨👤',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 2,
    },
    execute: (_state: GameState, attacker: Actor, _target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        effects.push({ type: 'SetStealth', target: 'self', amount: 2 });
        effects.push({
            type: 'Juice',
            effect: 'hiddenFade',
            target: attacker.position,
            metadata: {
                signature: 'STATE.FADE.SHADOW.SMOKE_SCREEN',
                family: 'status',
                primitive: 'state_fade',
                phase: 'instant',
                element: 'shadow',
                variant: 'smoke_screen',
                targetRef: { kind: 'target_hex' },
                skillId: 'SMOKE_SCREEN'
            }
        });

        messages.push("Smoke Screen!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (_state: GameState, origin: Point) => {
        return [origin];
    },
    upgrades: {},
    scenarios: getSkillScenarios('SMOKE_SCREEN')
};
