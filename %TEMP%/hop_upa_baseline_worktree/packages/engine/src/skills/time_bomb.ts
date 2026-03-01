import type { AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { getNeighbors } from '../hex';

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

        const center = attacker.position;
        const blastTiles = [center, ...getNeighbors(center)];
        const effects: AtomicEffect[] = blastTiles.map(pos => ({
            type: 'Damage',
            target: pos,
            amount: 1,
            reason: 'bomb_explosion',
        }));

        // Remove the bomb via normal damage resolution so death hooks stay consistent.
        effects.push({
            type: 'Damage',
            target: attacker.id,
            amount: 999,
            reason: 'bomb_explosion',
        });
        effects.push({
            type: 'Juice',
            effect: 'explosion_ring',
            target: center,
            intensity: 'high',
            metadata: {
                signature: 'ATK.BLAST.FIRE.TIME_BOMB',
                family: 'attack',
                primitive: 'blast',
                phase: 'impact',
                element: 'fire',
                variant: 'time_bomb',
                targetRef: { kind: 'target_hex' },
                skillId: 'TIME_BOMB'
            }
        });

        return {
            effects,
            messages: ['A bomb exploded!'],
            consumesTurn: true,
        };
    },
    getValidTargets: (_state: GameState, origin: Point) => [origin],
    upgrades: {},
};
