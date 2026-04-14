import { describe, expect, it } from 'vitest';
import { pointToKey } from '../hex';
import { createActiveSkill, SkillRegistry } from '../skillRegistry';
import { getRuntimeSkillLibraryMetadata, SkillRuntimeRegistry } from '../systems/skill-runtime';
import { createEnemy, createPlayer } from '../systems/entities/entity-factory';
import { createMockState, p } from './test_utils';
import type { GameState, Point } from '../types';

const placeWall = (state: GameState, position: Point): void => {
    state.tiles.set(pointToKey(position), {
        baseId: 'WALL',
        position,
        traits: new Set(['BLOCKS_LOS', 'BLOCKS_MOVEMENT']),
        effects: []
    });
};

const buildMeteorState = (): { state: GameState; player: ReturnType<typeof createPlayer>; axialEnemy: ReturnType<typeof createEnemy>; diagonalEnemy: ReturnType<typeof createEnemy> } => {
    const player = createPlayer({
        position: p(2, 2),
        speed: 10,
        skills: ['METEOR_IMPACT']
    });
    const axialEnemy = createEnemy({
        id: 'enemy-axial',
        subtype: 'skeleton',
        position: p(2, 4),
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    const diagonalEnemy = createEnemy({
        id: 'enemy-diagonal',
        subtype: 'skeleton',
        position: p(3, 3),
        speed: 1,
        skills: ['BASIC_ATTACK']
    });

    const state = createMockState({
        player,
        enemies: [axialEnemy, diagonalEnemy]
    });

    return { state, player, axialEnemy, diagonalEnemy };
};

const buildFirewallState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    target: Point;
    blockedPoint: Point;
    expectedWallPoints: Point[];
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['FIREWALL']
    });
    const target = p(3, 5);
    const state = createMockState({ player, enemies: [] });
    const expectedWallPoints = [
        target,
        p(4, 4),
        p(5, 3),
        p(2, 6),
        p(1, 7)
    ];
    const blockedPoint = p(2, 6);

    state.enemies.push(createEnemy({
        id: 'firewall-hit',
        subtype: 'skeleton',
        position: p(4, 4),
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));
    state.enemies.push(createEnemy({
        id: 'firewall-blocked',
        subtype: 'skeleton',
        position: blockedPoint,
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));
    placeWall(state, blockedPoint);

    return { state, player, target, blockedPoint, expectedWallPoints };
};

const buildCorpseExplosionState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    corpseTile: Point;
    invalidTile: Point;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['CORPSE_EXPLOSION']
    });
    const corpseTile = p(4, 4);
    const invalidTile = p(5, 5);
    const state = createMockState({ player, enemies: [] });
    state.tiles.set(pointToKey(corpseTile), {
        baseId: 'STONE',
        position: corpseTile,
        traits: new Set(['WALKABLE', 'CORPSE']),
        effects: []
    });
    state.enemies.push(createEnemy({
        id: 'corpse-center-target',
        subtype: 'skeleton',
        position: corpseTile,
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));
    state.enemies.push(createEnemy({
        id: 'corpse-neighbor-target',
        subtype: 'skeleton',
        position: p(5, 4),
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));

    return { state, player, corpseTile, invalidTile };
};

const buildBombTossState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    validTarget: Point;
    blockedTile: Point;
    occupiedTile: Point;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['BOMB_TOSS']
    });
    const validTarget = p(4, 3);
    const blockedTile = p(4, 4);
    const occupiedTile = p(3, 4);
    const state = createMockState({ player, enemies: [] });
    placeWall(state, blockedTile);
    state.enemies.push(createEnemy({
        id: 'bomb-occupied-target',
        subtype: 'skeleton',
        position: occupiedTile,
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));

    return { state, player, validTarget, blockedTile, occupiedTile };
};

const buildKineticTriTrapState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['KINETIC_TRI_TRAP']
    });
    const state = createMockState({ player, enemies: [] });
    return { state, player };
};

const buildShieldThrowState = (
    mode: 'actor' | 'wall' | 'empty'
): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    target: Point;
    impactPoint: Point;
    targetActorId?: string;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['SHIELD_THROW']
    });
    const state = createMockState({ player, enemies: [] });

    if (mode === 'actor') {
        const target = p(3, 1);
        const enemy = createEnemy({
            id: 'shield-throw-vm-target',
            subtype: 'footman',
            position: target,
            speed: 1,
            skills: ['BASIC_ATTACK']
        });
        state.enemies.push(enemy);
        return { state, player, target, impactPoint: target, targetActorId: enemy.id };
    }

    if (mode === 'wall') {
        const target = p(3, 1);
        const impactPoint = p(3, 1);
        placeWall(state, impactPoint);
        return { state, player, target, impactPoint };
    }

    const target = p(3, 1);
    return { state, player, target, impactPoint: target };
};

const buildArcherShotState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    target: Point;
    targetActorId: string;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['ARCHER_SHOT']
    });
    const target = p(3, 5);
    const enemy = createEnemy({
        id: 'archer-shot-vm-target',
        subtype: 'skeleton',
        position: target,
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    const state = createMockState({ player, enemies: [enemy] });
    return { state, player, target, targetActorId: enemy.id };
};

const buildSpearThrowState = (
    mode: 'throw' | 'lunge' | 'recall'
): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    target: Point;
    primaryEnemyId: string;
    secondaryEnemyId?: string;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['SPEAR_THROW']
    });

    if (mode === 'recall') {
        const primary = createEnemy({
            id: 'spear-recall-primary',
            subtype: 'footman',
            position: p(3, 2),
            speed: 1,
            skills: ['BASIC_ATTACK']
        });
        const secondary = createEnemy({
            id: 'spear-recall-secondary',
            subtype: 'footman',
            position: p(4, 1),
            speed: 1,
            skills: ['BASIC_ATTACK']
        });
        const state = createMockState({ player, enemies: [primary, secondary] });
        state.hasSpear = false;
        state.spearPosition = p(3, 1);
        return {
            state,
            player,
            target: player.position,
            primaryEnemyId: primary.id,
            secondaryEnemyId: secondary.id
        };
    }

    const target = mode === 'lunge' ? p(3, 1) : p(3, 0);
    const primary = createEnemy({
        id: 'spear-throw-primary',
        subtype: 'footman',
        position: target,
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    const state = createMockState({ player, enemies: [primary] });
    state.hasSpear = true;

    if (mode === 'lunge') {
        const secondary = createEnemy({
            id: 'spear-lunge-secondary',
            subtype: 'footman',
            position: p(4, 1),
            speed: 1,
            skills: ['BASIC_ATTACK']
        });
        state.enemies.push(secondary);
        return {
            state,
            player,
            target,
            primaryEnemyId: primary.id,
            secondaryEnemyId: secondary.id
        };
    }

    return {
        state,
        player,
        target,
        primaryEnemyId: primary.id
    };
};

const buildTimeBombState = (
    fuseDuration: number
): {
    state: GameState;
    bomb: ReturnType<typeof createEnemy>;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: []
    });
    const bomb = createEnemy({
        id: 'runtime-time-bomb',
        subtype: 'bomb',
        position: p(4, 4),
        speed: 1,
        skills: ['TIME_BOMB']
    });
    bomb.statusEffects = [{
        id: 'TIME_BOMB',
        type: 'time_bomb',
        duration: fuseDuration,
        tickWindow: 'END_OF_TURN'
    }];
    const state = createMockState({ player, enemies: [bomb] });

    return { state, bomb };
};

const buildFirewalkState = (
    withPhaseStep: boolean = false
): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    fireTile: Point;
    lavaTile: Point;
    occupiedFireTile: Point;
    phaseStepNearTile: Point;
    phaseStepFarTile: Point;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: withPhaseStep ? ['FIREWALK', 'PHASE_STEP'] : ['FIREWALK']
    });
    const fireTile = p(4, 3);
    const lavaTile = p(5, 3);
    const occupiedFireTile = p(4, 4);
    const phaseStepNearTile = p(3, 6);
    const phaseStepFarTile = p(3, 7);
    const state = createMockState({ player, enemies: [] });

    state.tiles.set(pointToKey(fireTile), {
        baseId: 'STONE',
        position: fireTile,
        traits: new Set(['WALKABLE']),
        effects: [{ id: 'FIRE', duration: 2, potency: 1 }]
    });
    state.tiles.set(pointToKey(occupiedFireTile), {
        baseId: 'STONE',
        position: occupiedFireTile,
        traits: new Set(['WALKABLE']),
        effects: [{ id: 'FIRE', duration: 2, potency: 1 }]
    });
    state.tiles.set(pointToKey(lavaTile), {
        baseId: 'LAVA',
        position: lavaTile,
        traits: new Set(['WALKABLE', 'LIQUID', 'HAZARDOUS']),
        effects: []
    });
    state.tiles.set(pointToKey(phaseStepNearTile), {
        baseId: 'LAVA',
        position: phaseStepNearTile,
        traits: new Set(['WALKABLE', 'LIQUID', 'HAZARDOUS']),
        effects: []
    });
    state.tiles.set(pointToKey(phaseStepFarTile), {
        baseId: 'LAVA',
        position: phaseStepFarTile,
        traits: new Set(['WALKABLE', 'LIQUID', 'HAZARDOUS']),
        effects: []
    });
    state.enemies.push(createEnemy({
        id: 'occupied-firewalk-target',
        subtype: 'skeleton',
        position: occupiedFireTile,
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));

    return { state, player, fireTile, lavaTile, occupiedFireTile, phaseStepNearTile, phaseStepFarTile };
};

const buildRaiseDeadState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    corpseTile: Point;
    pushedAlly: ReturnType<typeof createEnemy>;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['RAISE_DEAD']
    });
    const corpseTile = p(4, 3);
    const pushedAlly = createEnemy({
        id: 'raise-dead-pushed-ally',
        subtype: 'skeleton',
        position: corpseTile,
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    pushedAlly.factionId = player.factionId;
    const state = createMockState({ player, enemies: [pushedAlly] });
    state.tiles.set(pointToKey(corpseTile), {
        baseId: 'STONE',
        position: corpseTile,
        traits: new Set(['WALKABLE', 'CORPSE']),
        effects: []
    });

    return { state, player, corpseTile, pushedAlly };
};

const buildSetTrapState = (): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    trapTarget: Point;
    occupiedTarget: Point;
    blockedTarget: Point;
    lavaTarget: Point;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 10,
        skills: ['SET_TRAP']
    });
    const trapTarget = p(4, 3);
    const occupiedTarget = p(3, 4);
    const blockedTarget = p(4, 4);
    const lavaTarget = p(2, 4);
    const state = createMockState({ player, enemies: [] });
    placeWall(state, blockedTarget);
    state.tiles.set(pointToKey(lavaTarget), {
        baseId: 'LAVA',
        position: lavaTarget,
        traits: new Set(['WALKABLE', 'LIQUID', 'HAZARDOUS']),
        effects: []
    });
    state.enemies.push(createEnemy({
        id: 'set-trap-occupied',
        subtype: 'skeleton',
        position: occupiedTarget,
        speed: 1,
        skills: ['BASIC_ATTACK']
    }));

    return { state, player, trapTarget, occupiedTarget, blockedTarget, lavaTarget };
};

const buildBasicMoveState = (
    freeMove: boolean = false
): {
    state: GameState;
    player: ReturnType<typeof createPlayer>;
    reachableTarget: Point;
    occupiedTarget: Point;
} => {
    const player = createPlayer({
        position: p(3, 3),
        speed: 3,
        skills: ['BASIC_MOVE']
    });
    const ally = createEnemy({
        id: 'basic-move-ally',
        subtype: 'skeleton',
        position: p(4, 3),
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    ally.factionId = player.factionId;
    const occupiedTarget = p(5, 2);
    const blocker = createEnemy({
        id: 'basic-move-blocker',
        subtype: 'skeleton',
        position: occupiedTarget,
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    const scout = createEnemy({
        id: 'basic-move-scout',
        subtype: 'watcher',
        position: p(6, 3),
        speed: 1,
        skills: ['BASIC_ATTACK']
    });
    const state = createMockState({
        player,
        enemies: freeMove ? [ally, blocker, scout] : [ally, blocker]
    });
    const playerFog = state.visibility?.playerFog || {
        visibleTileKeys: [],
        exploredTileKeys: [],
        visibleActorIds: [],
        detectedActorIds: []
    };
    if (freeMove) {
        state.visibility = {
            playerFog,
            enemyAwarenessById: {}
        };
    } else {
        state.visibility = {
            playerFog,
            enemyAwarenessById: {
                [blocker.id]: {
                    enemyId: blocker.id,
                    memoryTurnsRemaining: 2,
                    lastKnownPlayerPosition: player.position,
                    lastSeenTurn: state.turnNumber,
                    butcherFactor: 0
                }
            }
        };
    }

    return {
        state,
        player,
        reachableTarget: p(5, 3),
        occupiedTarget
    };
};

describe('skill runtime vm', () => {
    it('registers generated runtime skills in the live registry and metadata export', () => {
        const meteor = SkillRuntimeRegistry.get('METEOR_IMPACT');
        const tornado = SkillRuntimeRegistry.get('TORNADO_KICK');
        const metadata = getRuntimeSkillLibraryMetadata();

        expect(meteor?.compiledFrom).toBe('json');
        expect(tornado?.compiledFrom).toBe('json');
        expect(SkillRegistry.get('METEOR_IMPACT')?.id).toBe('METEOR_IMPACT');
        expect(createActiveSkill('METEOR_IMPACT')?.range).toBe(3);
        expect(metadata.totalSkills).toBeGreaterThanOrEqual(2);
        expect(metadata.handlerBudgetExceeded).toBe(false);
        expect(metadata.skills.map(skill => skill.id)).toEqual(expect.arrayContaining([
            'METEOR_IMPACT',
            'TORNADO_KICK',
            'KINETIC_TRI_TRAP',
            'SHIELD_THROW',
            'ARCHER_SHOT',
            'SPEAR_THROW',
            'BASIC_MOVE',
            'FIREWALL',
            'CORPSE_EXPLOSION',
            'BOMB_TOSS',
            'RAISE_DEAD',
            'SET_TRAP',
            'TIME_BOMB',
            'FIREWALK',
            'ABSORB_FIRE',
            'THEME_HAZARDS',
            'VOLATILE_PAYLOAD'
        ]));
    });

    it('uses axial targeting and line-of-sight predicates for Meteor Impact', () => {
        const { state, player, axialEnemy, diagonalEnemy } = buildMeteorState();
        const meteor = SkillRegistry.get('METEOR_IMPACT');

        const clearTargets = meteor?.getValidTargets?.(state, player.position) || [];
        expect(clearTargets).toContainEqual(axialEnemy.position);
        expect(clearTargets).not.toContainEqual(diagonalEnemy.position);

        placeWall(state, p(2, 3));
        const blockedTargets = meteor?.getValidTargets?.(state, player.position) || [];
        expect(blockedTargets).not.toContainEqual(axialEnemy.position);
    });

    it('lowers Meteor Impact into displacement, damage, and message effects', () => {
        const { state, player, axialEnemy } = buildMeteorState();
        const meteor = SkillRegistry.get('METEOR_IMPACT');
        const result = meteor?.execute(state, player, axialEnemy.position);

        expect(result?.consumesTurn).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'Displacement'
            && effect.target === 'self'
            && effect.destination.q === axialEnemy.position.q
            && effect.destination.r === axialEnemy.position.r
            && effect.destination.s === axialEnemy.position.s
        )).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'Damage'
            && effect.target === axialEnemy.id
            && effect.amount === 5
            && effect.damageElement === 'kinetic'
        )).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Meteor Impact'))).toBe(true);
    });

    it('lowers Tornado Kick into pull, push, damage, and message effects', () => {
        const player = createPlayer({
            position: p(2, 2),
            speed: 10,
            skills: ['TORNADO_KICK']
        });
        const enemy = createEnemy({
            id: 'enemy-adjacent',
            subtype: 'skeleton',
            position: p(3, 2),
            speed: 1,
            skills: ['BASIC_ATTACK']
        });
        const state = createMockState({
            player,
            enemies: [enemy]
        });
        const tornado = SkillRegistry.get('TORNADO_KICK');
        const result = tornado?.execute(state, player, enemy.position);
        const applyForceEffects = result?.effects.filter(effect => effect.type === 'ApplyForce') || [];

        expect(result?.consumesTurn).toBe(true);
        expect(applyForceEffects).toHaveLength(2);
        expect(applyForceEffects[0]).toMatchObject({ mode: 'pull', target: enemy.id });
        expect(applyForceEffects[1]).toMatchObject({ mode: 'push', target: enemy.id });
        expect(result?.effects.some(effect =>
            effect.type === 'Damage'
            && effect.target === enemy.id
            && effect.amount === 3
        )).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Tornado Kick'))).toBe(true);
    });

    it('lowers Firewall into a perpendicular wall with deterministic order and wall filtering', () => {
        const { state, player, target, blockedPoint, expectedWallPoints } = buildFirewallState();
        const firewall = SkillRegistry.get('FIREWALL');
        const result = firewall?.execute(state, player, target);
        const firePlacements = result?.effects.filter(effect => effect.type === 'PlaceFire') || [];
        const damageEffects = result?.effects.filter(effect => effect.type === 'Damage') || [];

        expect(result?.consumesTurn).toBe(true);
        expect(firePlacements.map(effect => effect.type === 'PlaceFire' ? effect.position : null)).toEqual([
            expectedWallPoints[0],
            expectedWallPoints[1],
            expectedWallPoints[2],
            expectedWallPoints[4]
        ]);
        expect(firePlacements.some(effect =>
            effect.type === 'PlaceFire'
            && effect.position.q === blockedPoint.q
            && effect.position.r === blockedPoint.r
            && effect.position.s === blockedPoint.s
        )).toBe(false);
        expect(damageEffects.some(effect =>
            effect.type === 'Damage'
            && effect.target === 'firewall-hit'
        )).toBe(true);
        expect(damageEffects.some(effect =>
            effect.type === 'Damage'
            && effect.target === 'firewall-blocked'
        )).toBe(false);
        expect(result?.effects.some(effect =>
            effect.type === 'Juice'
            && effect.effect === 'flash'
        )).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Firewall'))).toBe(true);
    });

    it('truncates Firewall wall points at the map edge while preserving order', () => {
        const player = createPlayer({
            position: p(1, 4),
            speed: 10,
            skills: ['FIREWALL']
        });
        const state = createMockState({ player, enemies: [] });
        const firewall = SkillRegistry.get('FIREWALL');
        const target = p(1, 2);
        const result = firewall?.execute(state, player, target);
        const firePlacements = result?.effects.filter(effect => effect.type === 'PlaceFire') || [];

        expect(firePlacements.map(effect => effect.type === 'PlaceFire' ? effect.position : null)).toEqual([
            p(1, 2),
            p(0, 3),
            p(2, 1),
            p(3, 0)
        ]);
    });

    it('targets only corpse tiles for Corpse Explosion', () => {
        const { state, player, corpseTile, invalidTile } = buildCorpseExplosionState();
        const corpseExplosion = SkillRegistry.get('CORPSE_EXPLOSION');
        const targets = corpseExplosion?.getValidTargets?.(state, player.position) || [];

        expect(targets).toContainEqual(corpseTile);
        expect(targets).not.toContainEqual(invalidTile);
    });

    it('lowers Corpse Explosion with corpse removal before aoe damage', () => {
        const { state, player, corpseTile } = buildCorpseExplosionState();
        const corpseExplosion = SkillRegistry.get('CORPSE_EXPLOSION');
        const result = corpseExplosion?.execute(state, player, corpseTile);
        const removeCorpseIndex = result?.effects.findIndex(effect => effect.type === 'RemoveCorpse') ?? -1;
        const firstDamageIndex = result?.effects.findIndex(effect => effect.type === 'Damage') ?? -1;
        const damageEffects = result?.effects.filter(effect => effect.type === 'Damage') || [];

        expect(result?.consumesTurn).toBe(true);
        expect(removeCorpseIndex).toBe(0);
        expect(firstDamageIndex).toBeGreaterThan(removeCorpseIndex);
        expect(damageEffects).toHaveLength(7);
        expect(result?.effects.some(effect => effect.type === 'Juice' && effect.effect === 'explosion_ring')).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Corpse exploded'))).toBe(true);
    });

    it('samples Kinetic Tri-Trap placements deterministically and records rng consumption', () => {
        const { state, player } = buildKineticTriTrapState();
        const triTrap = SkillRegistry.get('KINETIC_TRI_TRAP');
        const result = triTrap?.execute(state, player, player.position, ['VOLATILE_CORE', 'TRAP_CHAIN_REACTION', 'QUICK_RELOAD']);
        const trapEffects = result?.effects.filter(effect => effect.type === 'PlaceTrap') || [];
        const trapPositions = trapEffects.map(effect => effect.type === 'PlaceTrap' ? pointToKey(effect.position) : '');
        const flashes = result?.effects.filter(effect => effect.type === 'Juice' && effect.effect === 'flash') || [];

        expect(result?.consumesTurn).toBe(true);
        expect(result?.rngConsumption).toBe(3);
        expect(result?.effects[0]).toMatchObject({ type: 'RemoveTrap', ownerId: player.id });
        expect(trapEffects).toHaveLength(3);
        expect(new Set(trapPositions).size).toBe(3);
        expect(trapEffects.every(effect =>
            effect.type === 'PlaceTrap'
            && effect.volatileCore === true
            && effect.chainReaction === true
            && effect.resetCooldown === 1
        )).toBe(true);
        expect(flashes).toHaveLength(3);
        expect(result?.messages).toContain('3 traps deployed.');
    });

    it('targets only walkable empty tiles for Bomb Toss and spawns a deterministic bomb actor', () => {
        const { state, player, validTarget, blockedTile, occupiedTile } = buildBombTossState();
        const bombToss = SkillRegistry.get('BOMB_TOSS');
        const targets = bombToss?.getValidTargets?.(state, player.position) || [];
        const result = bombToss?.execute(state, player, validTarget);
        const spawn = result?.effects.find(effect => effect.type === 'SpawnActor');

        expect(targets).toContainEqual(validTarget);
        expect(targets).not.toContainEqual(blockedTile);
        expect(targets).not.toContainEqual(occupiedTile);
        expect(result?.consumesTurn).toBe(true);
        expect(spawn?.type).toBe('SpawnActor');
        if (!spawn || spawn.type !== 'SpawnActor') return;
        expect(spawn.actor.id).toBe(`bomb-${player.id}-${state.turnNumber}-${state.actionLog?.length ?? 0}-${validTarget.q}_${validTarget.r}_${validTarget.s}`);
        expect(spawn.actor.subtype).toBe('bomb');
        expect(spawn.actor.factionId).toBe(player.factionId);
        expect(spawn.actor.activeSkills.some(skill => skill.id === 'TIME_BOMB')).toBe(true);
        expect(spawn.actor.activeSkills.some(skill => skill.id === 'VOLATILE_PAYLOAD')).toBe(true);
        expect(spawn.actor.statusEffects.some(status => status.type === 'time_bomb' && status.duration === 2)).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Bomb tossed'))).toBe(true);
    });

    it('resolves Shield Throw actor and empty branches, and rejects wall-blocked casts at intent time', () => {
        const actorCase = buildShieldThrowState('actor');
        const wallCase = buildShieldThrowState('wall');
        const emptyCase = buildShieldThrowState('empty');
        const shieldThrow = SkillRegistry.get('SHIELD_THROW');

        const actorResult = shieldThrow?.execute(actorCase.state, actorCase.player, actorCase.target);
        const wallResult = shieldThrow?.execute(wallCase.state, wallCase.player, wallCase.target);
        const emptyResult = shieldThrow?.execute(emptyCase.state, emptyCase.player, emptyCase.target);

        expect(actorResult?.effects.some(effect =>
            effect.type === 'ApplyStatus'
            && effect.target === actorCase.targetActorId
            && effect.status === 'stunned'
        )).toBe(true);
        expect(actorResult?.effects.some(effect =>
            effect.type === 'SpawnItem'
            && effect.itemType === 'shield'
        )).toBe(true);
        expect(actorResult?.effects.some(effect => effect.type === 'Juice' && effect.effect === 'shieldArc' && effect.path?.length)).toBe(true);
        expect(actorResult?.messages).toContain('Direct hit! Shield triggered kinetic pulse.');

        expect(wallResult?.consumesTurn).toBe(false);
        expect(wallResult?.messages).toContain('Invalid target.');

        expect(emptyResult?.effects.some(effect =>
            effect.type === 'SpawnItem'
            && effect.itemType === 'shield'
            && effect.position.q === emptyCase.target.q
            && effect.position.r === emptyCase.target.r
            && effect.position.s === emptyCase.target.s
        )).toBe(true);
        expect(emptyResult?.messages).toContain('Shield missed: No target at location.');
    });

    it('lowers Archer Shot through projectile trace, path-aware juice, and combat damage', () => {
        const { state, player, target, targetActorId } = buildArcherShotState();
        const archerShot = SkillRegistry.get('ARCHER_SHOT');
        const result = archerShot?.execute(state, player, target);
        const juiceEffects = result?.effects.filter(effect => effect.type === 'Juice') || [];

        expect(result?.consumesTurn).toBe(true);
        expect(result?.rngConsumption ?? 0).toBe(0);
        expect(juiceEffects.some(effect => effect.type === 'Juice' && effect.effect === 'aimingLaser' && effect.path?.length)).toBe(true);
        expect(juiceEffects.some(effect => effect.type === 'Juice' && effect.effect === 'spearTrail' && effect.path?.length)).toBe(true);
        expect(juiceEffects.some(effect => effect.type === 'Juice' && effect.effect === 'lightImpact' && effect.target === targetActorId)).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Damage' && effect.target === targetActorId)).toBe(true);
        expect(result?.messages).toContain('Archer shot!');
    });

    it('gates Time Bomb instructions until the fuse expires', () => {
        const { state, bomb } = buildTimeBombState(2);
        const timeBomb = SkillRegistry.get('TIME_BOMB');
        const result = timeBomb?.execute(state, bomb, bomb.position);

        expect(result?.consumesTurn).toBe(true);
        expect(result?.effects).toHaveLength(0);
        expect(result?.messages).toEqual([]);
    });

    it('detonates Time Bomb into neighbor blast, self-removal, and explosion juice', () => {
        const { state, bomb } = buildTimeBombState(1);
        const timeBomb = SkillRegistry.get('TIME_BOMB');
        const result = timeBomb?.execute(state, bomb, bomb.position);
        const damageEffects = result?.effects.filter(effect => effect.type === 'Damage') || [];

        expect(result?.consumesTurn).toBe(true);
        expect(damageEffects).toHaveLength(7);
        expect(damageEffects.filter(effect => effect.type === 'Damage' && typeof effect.target === 'string' && effect.target === bomb.id)).toHaveLength(1);
        expect(result?.effects.some(effect => effect.type === 'Juice' && effect.effect === 'explosion_ring')).toBe(true);
        expect(result?.messages).toContain('A bomb exploded!');
    });

    it('targets Firewalk only onto fire or lava destinations and excludes occupied tiles', () => {
        const { state, player, fireTile, lavaTile, occupiedFireTile } = buildFirewalkState();
        const firewalk = SkillRegistry.get('FIREWALK');
        const targets = firewalk?.getValidTargets?.(state, player.position) || [];

        expect(targets).toContainEqual(fireTile);
        expect(targets).toContainEqual(lavaTile);
        expect(targets).not.toContainEqual(occupiedFireTile);
    });

    it('honors movement capability range changes for Firewalk and lowers teleport/status effects', () => {
        const { state, player, phaseStepNearTile, phaseStepFarTile } = buildFirewalkState(true);
        const firewalk = SkillRegistry.get('FIREWALK');
        const targets = firewalk?.getValidTargets?.(state, player.position) || [];
        const result = firewalk?.execute(state, player, phaseStepNearTile);

        expect(targets).toContainEqual(phaseStepNearTile);
        expect(targets).not.toContainEqual(phaseStepFarTile);
        expect(result?.consumesTurn).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'Displacement'
            && effect.target === 'self'
            && effect.destination.q === phaseStepNearTile.q
            && effect.destination.r === phaseStepNearTile.r
            && effect.destination.s === phaseStepNearTile.s
            && effect.presentationKind === 'teleport'
        )).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'ApplyStatus'
            && effect.target === 'self'
            && effect.status === 'fire_immunity'
            && effect.duration === 2
        )).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Firewalk'))).toBe(true);
    });

    it('filters Raise Dead targets through summon placement and preserves ally-push ordering', () => {
        const { state, player, corpseTile, pushedAlly } = buildRaiseDeadState();
        const raiseDead = SkillRegistry.get('RAISE_DEAD');
        const targets = raiseDead?.getValidTargets?.(state, player.position) || [];
        const result = raiseDead?.execute(state, player, corpseTile);
        const displacementIndex = result?.effects.findIndex(effect =>
            effect.type === 'Displacement' && effect.target === pushedAlly.id
        ) ?? -1;
        const spawnIndex = result?.effects.findIndex(effect => effect.type === 'SpawnActor') ?? -1;

        expect(targets).toContainEqual(corpseTile);
        expect(result?.consumesTurn).toBe(true);
        expect(displacementIndex).toBeGreaterThanOrEqual(0);
        expect(spawnIndex).toBeGreaterThan(displacementIndex);
        expect(result?.effects.some(effect =>
            effect.type === 'SpawnActor'
            && effect.actor.id.startsWith('skeleton_')
            && effect.actor.position.q === corpseTile.q
            && effect.actor.position.r === corpseTile.r
        )).toBe(true);
        expect(result?.messages).toContain('Ally repositions to make room.');
        expect(result?.messages).toContain('Skeleton raised!');
    });

    it('lowers trap instructions directly and allows occupied but not blocked or lava targets', () => {
        const { state, player, trapTarget, occupiedTarget, blockedTarget, lavaTarget } = buildSetTrapState();
        const setTrap = SkillRegistry.get('SET_TRAP');
        const targets = setTrap?.getValidTargets?.(state, player.position) || [];
        const result = setTrap?.execute(state, player, occupiedTarget);

        expect(targets).toContainEqual(trapTarget);
        expect(targets).toContainEqual(occupiedTarget);
        expect(targets).not.toContainEqual(blockedTarget);
        expect(targets).not.toContainEqual(lavaTarget);
        expect(result?.consumesTurn).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'PlaceTrap'
            && effect.position.q === occupiedTarget.q
            && effect.position.r === occupiedTarget.r
            && effect.ownerId === player.id
        )).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Trap set'))).toBe(true);
    });

    it('resolves movement_reachable targets through the shared movement kernel and preserves path lowering', () => {
        const { state, player, reachableTarget, occupiedTarget } = buildBasicMoveState();
        const basicMove = SkillRegistry.get('BASIC_MOVE');
        const targets = basicMove?.getValidTargets?.(state, player.position) || [];
        const result = basicMove?.execute(state, player, reachableTarget);
        const displacement = result?.effects.find(effect => effect.type === 'Displacement');

        expect(targets).toContainEqual(reachableTarget);
        expect(targets).not.toContainEqual(occupiedTarget);
        expect(result?.consumesTurn).toBe(true);
        expect(displacement?.type).toBe('Displacement');
        if (!displacement || displacement.type !== 'Displacement') return;
        expect(displacement.destination).toEqual(reachableTarget);
        expect(displacement.path).toEqual([p(3, 3), p(4, 3), reachableTarget]);
        expect(displacement.ignoreCollision).toBe(true);
        expect(result?.messages).toContain('You moved to (5, 3). [Range 3]');
    });

    it('applies free-move interruption when movement_reachable crosses fresh enemy awareness', () => {
        const { state, player, reachableTarget } = buildBasicMoveState(true);
        const basicMove = SkillRegistry.get('BASIC_MOVE');
        const result = basicMove?.execute(state, player, reachableTarget);
        const displacement = result?.effects.find(effect => effect.type === 'Displacement');

        expect(displacement?.type).toBe('Displacement');
        if (!displacement || displacement.type !== 'Displacement') return;
        expect(displacement.destination).toEqual(p(4, 3));
        expect(displacement.path).toEqual([p(3, 3), p(4, 3)]);
        expect(result?.messages[0]).toContain('Free Move interrupted.');
        expect(result?.messages[1]).toBe('You moved to (4, 3). [Range 20]');
    });

    it('switches Spear Throw into recall mode with dynamic presentation and line-between effects', () => {
        const { state, player, target, primaryEnemyId, secondaryEnemyId } = buildSpearThrowState('recall');
        const spearThrow = SkillRegistry.get('SPEAR_THROW');
        const targets = spearThrow?.getValidTargets?.(state, player.position) || [];
        const result = spearThrow?.execute(state, player, target, ['RECALL_DAMAGE', 'SPEAR_CLEAVE']);

        expect(targets).toEqual([player.position]);
        expect(typeof spearThrow?.name).toBe('function');
        expect((spearThrow?.name as (runtimeState: GameState) => string)(state)).toBe('Recall Spear');
        expect(result?.effects.some(effect => effect.type === 'Damage' && effect.target === primaryEnemyId)).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Damage' && effect.target === secondaryEnemyId)).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'PickupSpear')).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Juice' && effect.effect === 'spearTrail' && effect.path?.length)).toBe(true);
        expect(result?.messages).toContain('Spear recalled.');
        expect(result?.messages).toContain('Cleave triggered on pickup.');
    });

    it('lowers Spear Throw lunge and lunge-arc branches declaratively', () => {
        const { state, player, target, primaryEnemyId, secondaryEnemyId } = buildSpearThrowState('lunge');
        const spearThrow = SkillRegistry.get('SPEAR_THROW');
        const result = spearThrow?.execute(state, player, target, ['LUNGE', 'LUNGE_ARC', 'DEEP_BREATH']);

        expect(result?.effects.some(effect =>
            effect.type === 'Displacement'
            && effect.target === 'self'
            && effect.destination.q === target.q
            && effect.destination.r === target.r
            && effect.destination.s === target.s
        )).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Damage' && effect.target === primaryEnemyId)).toBe(true);
        expect(result?.effects.some(effect => effect.type === 'Damage' && effect.target === secondaryEnemyId)).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'ApplyAilment'
            && effect.target === primaryEnemyId
            && effect.ailment === 'bleed'
        )).toBe(true);
        expect(result?.effects.some(effect =>
            effect.type === 'ModifyCooldown'
            && effect.skillId === 'JUMP'
            && effect.setExact === true
        )).toBe(true);
        expect(result?.messages).toContain('Lunged and killed enemy !');
    });
});
