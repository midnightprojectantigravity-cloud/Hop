import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { createCompanion, createEnemy, createPlayer, ensureActorTrinity } from '../systems/entity-factory';
import type { TrinityComponent } from '../systems/components';

const readTrinity = (components?: Map<string, any>): TrinityComponent | undefined =>
    components?.get('trinity') as TrinityComponent | undefined;

describe('entity-factory trinity defaults', () => {
    it('supports neutral trinity profile activation via env flag', () => {
        const prev = process.env.HOP_TRINITY_PROFILE;
        process.env.HOP_TRINITY_PROFILE = 'neutral';
        try {
            const player = createPlayer({
                position: { q: 0, r: 0, s: 0 },
                skills: ['BASIC_MOVE'],
                archetype: 'FIREMAGE',
            });
            expect(readTrinity(player.components)).toEqual({
                type: 'trinity',
                body: 0,
                mind: 0,
                instinct: 0,
            });
            expect(player.maxHp).toBe(1);
            expect(player.hp).toBe(1);
        } finally {
            if (prev === undefined) {
                delete process.env.HOP_TRINITY_PROFILE;
            } else {
                process.env.HOP_TRINITY_PROFILE = prev;
            }
        }
    });

    it('assigns deterministic live trinity to player entities by default', () => {
        const player = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            archetype: 'FIREMAGE',
        });

        expect(readTrinity(player.components)).toEqual({
            type: 'trinity',
            body: 2,
            mind: 9,
            instinct: 4,
        });
    });

    it('assigns deterministic live trinity to enemies by default', () => {
        const enemy = createEnemy({
            id: 'e1',
            subtype: 'footman',
            position: { q: 1, r: 0, s: -1 },
            hp: 1,
            maxHp: 1,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        });

        expect(readTrinity(enemy.components)).toEqual({
            type: 'trinity',
            body: 0,
            mind: 0,
            instinct: 0,
        });
    });

    it('assigns deterministic live trinity for falcon and skeleton companions', () => {
        const falcon = createCompanion({
            companionType: 'falcon',
            ownerId: 'player',
            position: { q: 0, r: 1, s: -1 },
        });
        const skeleton = createCompanion({
            companionType: 'skeleton',
            ownerId: 'player',
            position: { q: 1, r: 1, s: -2 },
        });

        expect(readTrinity(falcon.components)).toEqual({
            type: 'trinity',
            body: 2,
            mind: 2,
            instinct: 9,
        });
        expect(readTrinity(skeleton.components)).toEqual({
            type: 'trinity',
            body: 5,
            mind: 1,
            instinct: 4,
        });
    });

    it('preserves explicit trinity override when provided', () => {
        const player = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            archetype: 'VANGUARD',
            trinity: { body: 9, mind: 9, instinct: 9 },
        });

        expect(readTrinity(player.components)).toEqual({
            type: 'trinity',
            body: 9,
            mind: 9,
            instinct: 9,
        });
    });

    it('generateInitialState produces trinity for player and spawned enemies', () => {
        const state = generateInitialState(3, 'trinity-factory-seed');

        expect(readTrinity(state.player.components)).toBeTruthy();
        for (const enemy of state.enemies) {
            expect(readTrinity(enemy.components)).toBeTruthy();
        }
    });

    it('ensureActorTrinity backfills missing trinity on manual actors', () => {
        const enemy = createEnemy({
            id: 'e-manual',
            subtype: 'footman',
            position: { q: 1, r: 0, s: -1 },
            hp: 1,
            maxHp: 1,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        });
        enemy.components = new Map();
        const normalized = ensureActorTrinity(enemy);
        expect(readTrinity(normalized.components)).toEqual({
            type: 'trinity',
            body: 0,
            mind: 0,
            instinct: 0,
        });
    });
});
