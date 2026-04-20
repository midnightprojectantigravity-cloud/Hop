import type { AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { buildBombDetonationEffects } from '../systems/effects/bomb-runtime';

/**
 * TIME_BOMB
 * Self-executed fuse logic for deployed bomb actors.
 * The bomb detonates when its `time_bomb` status counter reaches 1 or lower.
 */
export const TIME_BOMB: SkillDefinition = {
    id: 'TIME_BOMB',
    name: 'Time Bomb',
    description: 'Detonates when the fuse reaches zero.',
    slot: 'passive',
    icon: '💥',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (_state: GameState, attacker, _target?: Point) => {
        const fuse = attacker.statusEffects.find(s => s.type === 'time_bomb');
        if (fuse && fuse.duration > 1) {
            return { effects: [], messages: [], consumesTurn: true };
        }

        const effects: AtomicEffect[] = buildBombDetonationEffects(attacker);

        return {
            effects,
            messages: ['A bomb exploded!'],
            consumesTurn: true,
        };
    },
    getValidTargets: (_state: GameState, origin: Point) => [origin],
    upgrades: {},
};
