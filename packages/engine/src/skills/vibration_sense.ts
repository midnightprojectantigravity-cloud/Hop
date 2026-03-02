import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { hexEquals } from '../hex';
import { extractTrinityStats } from '../systems/combat/combat-calculator';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const VIBRATION_SENSE: SkillDefinition = {
    id: 'VIBRATION_SENSE',
    name: 'Vibration Sense',
    description: 'Sense moving units through walls using Instinct.',
    slot: 'passive',
    icon: 'VS',
    baseVariables: {
        range: 4,
        cost: 0,
        cooldown: 0
    },
    execute: (_state: GameState, _attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[] } => ({
        effects: [],
        messages: []
    }),
    getValidTargets: () => [],
    capabilities: {
        senses: [{
            domain: 'senses',
            providerId: 'vibration_sense.motion',
            priority: 25,
            resolve: (query) => {
                const trinity = extractTrinityStats(query.observer);
                const range = clamp(4 + Math.floor(trinity.instinct / 8), 4, 6);
                if (query.distance > range) {
                    return {
                        decision: 'neutral',
                        channelId: 'vibration_sense',
                        maxRange: range
                    };
                }

                const targetActor = query.targetActor;
                const movedLastTurn = Boolean(
                    targetActor
                    && targetActor.previousPosition
                    && !hexEquals(targetActor.previousPosition, targetActor.position)
                );
                if (!movedLastTurn) {
                    return {
                        decision: 'neutral',
                        channelId: 'vibration_sense',
                        maxRange: range
                    };
                }

                return {
                    decision: 'allow',
                    channelId: 'vibration_sense',
                    maxRange: range
                };
            }
        }]
    },
    upgrades: {}
};
