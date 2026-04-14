import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { createCompanion, createEnemy, createPlayer, ensureActorTrinity } from '../systems/entities/entity-factory';
import type { TrinityComponent } from '../systems/components';

const readTrinity = (components?: Map<string, any>): TrinityComponent | undefined =>
    components?.get('trinity') as TrinityComponent | undefined;

describe('entity-factory trinity defaults', () => {
    it('assigns deterministic live trinity to player entities by default', () => {
        const player = createPlayer({
            position: { q: 0, r: 0, s: 0 },
            skills: ['BASIC_MOVE'],
            archetype: 'FIREMAGE',
        });

        expect(readTrinity(player.components)).toEqual({
            type: 'trinity',
            body: 5,
            mind: 30,
            instinct: 15,
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
            body: 12,
            mind: 3,
            instinct: 6,
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
            body: 4,
            mind: 6,
            instinct: 18,
        });
        expect(readTrinity(skeleton.components)).toEqual({
            type: 'trinity',
            body: 12,
            mind: 2,
            instinct: 6,
        });
        expect(skeleton.hp).toBe(86);
        expect(skeleton.maxHp).toBe(86);
        expect(skeleton.speed).toBe(50);
        const skeletonSkills = new Set((skeleton.activeSkills || []).map(s => s.id));
        expect(skeletonSkills.has('BASIC_MOVE')).toBe(true);
        expect(skeletonSkills.has('BASIC_ATTACK')).toBe(true);
        expect(skeletonSkills.has('ENEMY_AWARENESS')).toBe(true);
        expect(skeleton.behaviorState?.controller).toBe('generic_ai');
    });

    it('applies summon overrides on top of the default skeleton baseline', () => {
        const skeleton = createCompanion({
            companionType: 'skeleton',
            ownerId: 'necromancer',
            ownerFactionId: 'enemy',
            position: { q: 1, r: 1, s: -2 },
            summon: {
                companionType: 'skeleton',
                visualAssetRef: '/Hop/assets/bestiary/unit.skeleton.basic.01.webp',
                trinity: { body: 20, mind: 6, instinct: 3 },
                skills: ['BASIC_MOVE', 'DEATH_TOUCH'],
                behavior: {
                    controller: 'manual',
                    anchorActorId: 'owner',
                    overlays: [{
                        id: 'skeleton_guard',
                        source: 'summon',
                        sourceId: 'raise_dead',
                        desiredRange: 1
                    }]
                }
            }
        });

        expect(readTrinity(skeleton.components)).toEqual({
            type: 'trinity',
            body: 20,
            mind: 6,
            instinct: 3,
        });
        expect(skeleton.factionId).toBe('enemy');
        expect(skeleton.visualAssetRef).toBe('/Hop/assets/bestiary/unit.skeleton.basic.01.webp');
        expect(skeleton.behaviorState?.controller).toBe('manual');
        expect(skeleton.behaviorState?.anchorActorId).toBe('necromancer');
        expect(skeleton.behaviorState?.overlays[0]?.sourceId).toBe('raise_dead');
        const skeletonSkills = new Set((skeleton.activeSkills || []).map(s => s.id));
        expect(skeletonSkills.has('BASIC_MOVE')).toBe(true);
        expect(skeletonSkills.has('DEATH_TOUCH')).toBe(true);
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
            body: 12,
            mind: 3,
            instinct: 6,
        });
    });
});
