import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';

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
    execute: (state: GameState, attacker: Actor, _target?: Point, activeUpgrades: string[] = []) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        const hasBlindingSmoke = activeUpgrades.includes('BLINDING_SMOKE');

        effects.push({ type: 'SetStealth', target: 'self', amount: 2 });

        if (hasBlindingSmoke) {
            const hostileActors = [state.player, ...state.enemies, ...(state.companions || [])].filter(actor =>
                actor.id !== attacker.id
                && actor.hp > 0
                && actor.factionId !== attacker.factionId
                && hexDistance(attacker.position, actor.position) <= 1
            );
            for (const hostileActor of hostileActors) {
                effects.push({
                    type: 'ApplyStatus',
                    target: hostileActor.id,
                    status: 'blinded',
                    duration: 1
                });
            }
            if (hostileActors.length > 0) {
                messages.push('Blinding smoke obscures nearby foes!');
            }
        }

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
    upgrades: {
        BLINDING_SMOKE: {
            id: 'BLINDING_SMOKE',
            name: 'Blinding Smoke',
            description: 'Adjacent hostile units are blinded for 1 turn.'
        }
    },
};
