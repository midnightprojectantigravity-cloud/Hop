import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { BOMB_TOSS } from '../skills/bomb_toss';
import { TIME_BOMB } from '../skills/time_bomb';
import { selectGenericUnitAiAction } from '../systems/ai/generic-unit-ai';
import { createEnemy } from '../systems/entities/entity-factory';
import { applyEffects } from '../systems/effect-engine';
import { resolveRuntimeSkillResourceProfile } from '../systems/ires';
import { buildInitiativeQueue } from '../systems/initiative';
import { buildBombFuseStatus } from '../systems/effects/bomb-runtime';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';
import { getSkillDefinition } from '../skillRegistry';

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
        expect(spawn.actor.armorBurdenTier).toBe('None');
        expect(spawn.actor.speed).toBe(1);
        expect(spawn.actor.activeSkills.some(s => s.id === 'TIME_BOMB')).toBe(true);
        expect(spawn.actor.activeSkills.some(s => s.id === 'VOLATILE_PAYLOAD')).toBe(true);
        expect(spawn.actor.activeSkills.some(s => s.id === 'BASIC_MOVE')).toBe(false);
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
        expect(explodeResult.effects.filter(e => e.type === 'Damage')).toHaveLength(7);
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

    it('positive damage to a volatile bomb detonates it immediately', () => {
        const state = generateInitialState(1, 'time-bomb-volatile-seed');
        state.player = {
            ...state.player,
            position: { q: 4, r: 5, s: -9 },
            hp: 5,
            maxHp: 5,
        };

        const bomb = createEnemy({
            id: 'bomb-volatile',
            subtype: 'bomb',
            position: { q: 4, r: 6, s: -10 },
            speed: 1,
            skills: ['TIME_BOMB', 'VOLATILE_PAYLOAD'],
        });
        state.enemies = [bomb];

        const nextState = applyEffects(state, [
            { type: 'Damage', target: bomb.id, amount: 1, reason: 'test_hit' }
        ], {
            sourceId: state.player.id,
            targetId: bomb.id
        });

        expect(nextState.player.hp).toBe(4);
        expect(nextState.enemies.some(e => e.id === bomb.id)).toBe(false);
    });

    it('volatile bomb explosions chain into other bombs deterministically', () => {
        const state = generateInitialState(1, 'time-bomb-chain-seed');
        state.player = {
            ...state.player,
            position: { q: 4, r: 4, s: -8 },
            hp: 5,
            maxHp: 5,
        };

        const leftBomb = createEnemy({
            id: 'bomb-left',
            subtype: 'bomb',
            position: { q: 4, r: 5, s: -9 },
            speed: 1,
            skills: ['TIME_BOMB', 'VOLATILE_PAYLOAD'],
        });
        const rightBomb = createEnemy({
            id: 'bomb-right',
            subtype: 'bomb',
            position: { q: 5, r: 5, s: -10 },
            speed: 1,
            skills: ['TIME_BOMB', 'VOLATILE_PAYLOAD'],
        });
        state.enemies = [leftBomb, rightBomb];

        const nextState = applyEffects(state, [
            { type: 'Damage', target: leftBomb.id, amount: 1, reason: 'test_hit' }
        ], {
            sourceId: state.player.id,
            targetId: leftBomb.id
        });

        expect(nextState.player.hp).toBe(4);
        expect(nextState.enemies.some(e => e.id === leftBomb.id)).toBe(false);
        expect(nextState.enemies.some(e => e.id === rightBomb.id)).toBe(false);
    });

    it('keeps TIME_BOMB metabolically inert even though it consumes a turn', () => {
        const profile = resolveRuntimeSkillResourceProfile('TIME_BOMB', getSkillDefinition('TIME_BOMB'));

        expect(profile.profileSource).toBe('band_derived');
        expect(profile.primaryResource).toBe('none');
        expect(profile.primaryCost).toBe(0);
        expect(profile.baseStrain).toBe(0);
        expect(profile.countsAsMovement).toBe(false);
        expect(profile.countsAsAction).toBe(false);
    });

    it('detonates on its own during the live turn loop when the fuse expires', () => {
        const seed = 'time-bomb-live-fuse';
        const base = generateInitialState(1, seed);
        const bomb = createEnemy({
            id: 'bomb-live-loop',
            subtype: 'bomb',
            position: createHex(4, 6),
            speed: 10,
            skills: ['TIME_BOMB', 'VOLATILE_PAYLOAD']
        });
        bomb.statusEffects = [buildBombFuseStatus(1)];

        const seeded = {
            ...base,
            player: {
                ...base.player,
                position: createHex(4, 5),
                previousPosition: createHex(4, 5),
                hp: 5,
                maxHp: 5
            },
            enemies: [bomb]
        };
        let state = recomputeVisibilityFromScratch({
            ...seeded,
            initiativeQueue: buildInitiativeQueue(seeded),
            occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
        });

        state = gameReducer(state, { type: 'ADVANCE_TURN' });
        state = gameReducer(state, { type: 'ADVANCE_TURN' });

        expect(state.enemies.some(enemy => enemy.id === bomb.id)).toBe(false);
        expect(state.player.hp).toBe(4);
    });

    it('selects BOMB_TOSS when a legal throw already threatens a hostile', () => {
        const seed = 'bomber-ai-throws-when-live';
        const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
        const bomber = {
            ...createEnemy({
                id: 'bomber-ai',
                subtype: 'bomber',
                position: createHex(4, 1),
                hp: 10,
                maxHp: 10,
                speed: 1,
                skills: ['BASIC_MOVE', 'BOMB_TOSS']
            }),
            previousPosition: createHex(4, 1)
        };
        const seeded = {
            ...base,
            player: {
                ...base.player,
                position: createHex(4, 4),
                previousPosition: createHex(4, 4)
            },
            enemies: [bomber]
        };
        const state = recomputeVisibilityFromScratch({
            ...seeded,
            initiativeQueue: buildInitiativeQueue(seeded),
            occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
        });

        const result = selectGenericUnitAiAction({
            state,
            actor: state.enemies[0],
            side: 'enemy',
            simSeed: seed,
            decisionCounter: 0
        });

        expect(result.selected.action.type).toBe('USE_SKILL');
        if (result.selected.action.type !== 'USE_SKILL') return;
        expect(result.selected.action.payload.skillId).toBe('BOMB_TOSS');
        expect(result.selected.facts?.createsThreatNextDecision).toBe(true);
    });
});
