import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { RAISE_DEAD } from '../skills/raise_dead';
import { resolveBehaviorAnchorTarget, resolveBehaviorProfile } from '../systems/ai/behavior-profile';
import { createCompanion, createEnemy } from '../systems/entities/entity-factory';
import { buildInitiativeQueue } from '../systems/initiative';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';

const buildState = ({
    seed,
    playerPos = createHex(4, 4),
    enemies = [],
    companions = []
}: {
    seed: string;
    playerPos?: ReturnType<typeof createHex>;
    enemies?: ReturnType<typeof createEnemy>[];
    companions?: ReturnType<typeof createCompanion>[];
}) => {
    const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
    const seeded = {
        ...base,
        player: {
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        },
        enemies,
        companions
    };
    const withQueue = {
        ...seeded,
        initiativeQueue: buildInitiativeQueue(seeded),
        occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
    };
    return recomputeVisibilityFromScratch(withQueue);
};

describe('behavior profile resolution', () => {
    it('resolves aggressive melee defaults from a generic move-plus-attack loadout', () => {
        const actor = createEnemy({
            id: 'behavior-melee',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 18,
            maxHp: 18,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK']
        });
        const state = buildState({
            seed: 'behavior-melee',
            enemies: [actor]
        });

        const resolved = resolveBehaviorProfile(state, state.enemies[0]);

        expect(resolved.desiredRange).toBe(1);
        expect(resolved.offenseBias).toBeGreaterThan(resolved.selfPreservationBias);
        expect(resolved.preferDamageOverPositioning).toBe(true);
        expect(resolved.hasDirectDamagePlan).toBe(true);
    });

    it('derives archer-like range from skills without relying on subtype', () => {
        const actor = createEnemy({
            id: 'behavior-archer',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 18,
            maxHp: 18,
            speed: 1,
            skills: ['BASIC_MOVE', 'ARCHER_SHOT']
        });
        const state = buildState({
            seed: 'behavior-archer',
            enemies: [actor]
        });

        const resolved = resolveBehaviorProfile(state, state.enemies[0]);

        expect(resolved.desiredRange).toEqual([2, 4]);
        expect(resolved.selfPreservationBias).toBeGreaterThan(0.45);
        expect(resolved.sourceIds).toContain('skill_ready:ARCHER_SHOT');
    });

    it('derives bomber distance from skill range plus one', () => {
        const actor = createEnemy({
            id: 'behavior-bomber',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 18,
            maxHp: 18,
            speed: 1,
            skills: ['BASIC_MOVE', 'BOMB_TOSS']
        });
        const state = buildState({
            seed: 'behavior-bomber',
            enemies: [actor]
        });

        const resolved = resolveBehaviorProfile(state, state.enemies[0]);

        expect(resolved.desiredRange).toBe(4);
        expect(resolved.controlBias).toBeGreaterThan(resolved.selfPreservationBias);
        expect(resolved.sourceIds).toContain('skill_ready:BOMB_TOSS');
    });

    it('keeps cooldown-ranged identity as a weak overlay until the ranged skill is ready again', () => {
        const actor = createEnemy({
            id: 'behavior-hybrid',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 18,
            maxHp: 18,
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK', 'ARCHER_SHOT']
        });
        actor.activeSkills = actor.activeSkills.map(skill =>
            skill.id === 'ARCHER_SHOT'
                ? { ...skill, currentCooldown: 2 }
                : skill
        );
        const state = buildState({
            seed: 'behavior-hybrid',
            enemies: [actor]
        });

        const resolved = resolveBehaviorProfile(state, state.enemies[0]);

        expect(resolved.desiredRange).toBe(1);
        expect(resolved.selfPreservationBias).toBeGreaterThan(0.45);
        expect(resolved.sourceIds).toContain('skill_static:ARCHER_SHOT');
        expect(resolved.sourceIds).not.toContain('skill_ready:ARCHER_SHOT');
    });

    it('applies support fallback when an actor has no direct damage path', () => {
        const actor = createEnemy({
            id: 'behavior-support',
            subtype: 'footman',
            position: createHex(4, 2),
            hp: 18,
            maxHp: 18,
            speed: 1,
            skills: ['STANDARD_VISION']
        });
        const state = buildState({
            seed: 'behavior-support',
            enemies: [actor]
        });

        const resolved = resolveBehaviorProfile(state, state.enemies[0]);

        expect(resolved.hasDirectDamagePlan).toBe(false);
        expect(resolved.preferDamageOverPositioning).toBe(false);
        expect(resolved.controlBias).toBeGreaterThan(resolved.offenseBias);
        expect(resolved.sourceIds).toContain('capability:no_direct_damage');
    });

    it('uses the same resolver and temporary anchor state for companions', () => {
        const falcon = createCompanion({
            companionType: 'falcon',
            ownerId: 'player',
            position: createHex(5, 4)
        });
        const state = buildState({
            seed: 'behavior-falcon',
            companions: [falcon]
        });

        const resolved = resolveBehaviorProfile(state, state.companions?.[0] ?? falcon);
        const anchor = resolveBehaviorAnchorTarget(state, state.companions?.[0] ?? falcon);

        expect(resolved.desiredRange).toBe(1);
        expect(anchor.kind).toBe('anchor_actor');
        if (anchor.kind === 'anchor_actor') {
            expect(anchor.actorId).toBe('player');
        }
        expect(resolved.sourceIds).toContain('summon:falcon_roost');
    });

    it('applies summon-created overlays to raised skeletons', () => {
        const target = createHex(4, 3);
        const base = buildState({
            seed: 'behavior-raise-dead'
        });
        const tile = base.tiles.get(pointToKey(target));
        if (!tile) {
            throw new Error('Expected target tile to exist for raise dead test');
        }
        const state = {
            ...base,
            tiles: new Map(base.tiles)
        };
        state.tiles.set(pointToKey(target), {
            ...tile,
            traits: new Set([...(tile.traits || []), 'CORPSE'])
        });

        const result = RAISE_DEAD.execute(state, state.player, target);
        const spawned = result.effects.find(effect => effect.type === 'SpawnActor');

        expect(spawned?.type).toBe('SpawnActor');
        if (spawned?.type === 'SpawnActor') {
            expect(spawned.actor.behaviorState?.anchorActorId).toBe(state.player.id);
            expect(spawned.actor.behaviorState?.overlays[0]?.sourceId).toBe('raise_dead');
            expect(spawned.actor.behaviorState?.overlays[0]?.desiredRange).toBe(1);
        }
    });
});
