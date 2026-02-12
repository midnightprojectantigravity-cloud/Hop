import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { BOMB_TOSS } from '../skills/bomb_toss';
import { TIME_BOMB } from '../skills/time_bomb';
import { createEnemy } from '../systems/entity-factory';
import { applyEffects } from '../systems/effect-engine';

describe('bomber summon contract', () => {
    it('BOMB_TOSS spawns a bomb actor with TIME_BOMB and fuse status', () => {
        const state = generateInitialState(1, 'bomb-contract-seed');
        const attacker = createEnemy({
            id: 'bomber-1',
            subtype: 'bomber',
            position: { q: 4, r: 5, s: -9 },
            speed: 1,
            skills: ['BOMB_TOSS'],
        });
        const target = { q: 4, r: 4, s: -8 };

        const result = BOMB_TOSS.execute(state, attacker, target);
        expect(result.consumesTurn).toBe(true);

        const spawn = result.effects.find(e => e.type === 'SpawnActor');
        expect(spawn?.type).toBe('SpawnActor');
        if (!spawn || spawn.type !== 'SpawnActor') return;

        expect(spawn.actor.subtype).toBe('bomb');
        expect(spawn.actor.activeSkills.some(s => s.id === 'TIME_BOMB')).toBe(true);
        const fuse = spawn.actor.statusEffects.find(s => s.type === 'time_bomb');
        expect(fuse?.duration).toBe(2);
    });

    it('TIME_BOMB waits while fuse is above one and explodes at one', () => {
        const state = generateInitialState(1, 'time-bomb-fuse-seed');
        const bombTicking = createEnemy({
            id: 'bomb-ticking',
            subtype: 'bomb',
            position: { q: 4, r: 5, s: -9 },
            speed: 10,
            skills: ['TIME_BOMB'],
        });
        bombTicking.statusEffects = [{ id: 'TIME_BOMB', type: 'time_bomb' as const, duration: 2, tickWindow: 'END_OF_TURN' as const }];
        const idleResult = TIME_BOMB.execute(state, bombTicking, bombTicking.position);
        expect(idleResult.effects).toHaveLength(0);
        expect(idleResult.consumesTurn).toBe(true);

        const bombReady = {
            ...bombTicking,
            statusEffects: [{ id: 'TIME_BOMB', type: 'time_bomb' as const, duration: 1, tickWindow: 'END_OF_TURN' as const }]
        };
        const explodeResult = TIME_BOMB.execute(state, bombReady, bombReady.position);
        expect(explodeResult.effects.filter(e => e.type === 'Damage')).toHaveLength(8);
        expect(explodeResult.messages.some(m => m.includes('exploded'))).toBe(true);
    });

    it('TIME_BOMB explosion damages nearby units and removes the bomb', () => {
        const state = generateInitialState(1, 'time-bomb-apply-seed');
        state.player = {
            ...state.player,
            position: { q: 4, r: 5, s: -9 },
            hp: 5,
            maxHp: 5,
        };

        const bomb = createEnemy({
            id: 'bomb-live',
            subtype: 'bomb',
            position: { q: 4, r: 6, s: -10 },
            speed: 10,
            skills: ['TIME_BOMB'],
        });
        bomb.statusEffects = [{ id: 'TIME_BOMB', type: 'time_bomb' as const, duration: 1, tickWindow: 'END_OF_TURN' as const }];
        state.enemies = [bomb];

        const detonation = TIME_BOMB.execute(state, bomb, bomb.position);
        const nextState = applyEffects(state, detonation.effects, { sourceId: bomb.id });

        expect(nextState.player.hp).toBe(4);
        expect(nextState.enemies.some(e => e.id === bomb.id)).toBe(false);
    });
});
