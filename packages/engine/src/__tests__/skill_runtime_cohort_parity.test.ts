import { describe, expect, it } from 'vitest';
import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { SkillRegistry } from '../skillRegistry';
import { createCompanion, createEnemy, createPlayer } from '../systems/entities/entity-factory';
import { SkillRuntimeRegistry } from '../systems/skill-runtime';
import { createMockState, p } from './test_utils';
import { ABSORB_FIRE as LEGACY_ABSORB_FIRE } from '../skills/absorb_fire';
import { FALCON_APEX_STRIKE as LEGACY_FALCON_APEX_STRIKE } from '../skills/falcon_apex_strike';
import { FALCON_AUTO_ROOST as LEGACY_FALCON_AUTO_ROOST } from '../skills/falcon_auto_roost';
import { FALCON_COMMAND as LEGACY_FALCON_COMMAND } from '../skills/falcon_command';
import { FALCON_HEAL as LEGACY_FALCON_HEAL } from '../skills/falcon_heal';
import { FALCON_PECK as LEGACY_FALCON_PECK } from '../skills/falcon_peck';
import { FALCON_SCOUT as LEGACY_FALCON_SCOUT } from '../skills/falcon_scout';
import { AUTO_ATTACK as LEGACY_AUTO_ATTACK } from '../skills/auto_attack';
import { BASIC_AWARENESS as LEGACY_BASIC_AWARENESS } from '../skills/basic_awareness';
import { BASIC_ATTACK as LEGACY_BASIC_ATTACK } from '../skills/basic_attack';
import { BASIC_MOVE as LEGACY_BASIC_MOVE } from '../skills/basic_move';
import { BLIND_FIGHTING as LEGACY_BLIND_FIGHTING } from '../skills/blind_fighting';
import { BOMB_TOSS as LEGACY_BOMB_TOSS } from '../skills/bomb_toss';
import { BURROW as LEGACY_BURROW } from '../skills/burrow';
import { CORPSE_EXPLOSION as LEGACY_CORPSE_EXPLOSION } from '../skills/corpse_explosion';
import { COMBAT_ANALYSIS as LEGACY_COMBAT_ANALYSIS } from '../skills/combat_analysis';
import { DEATH_TOUCH as LEGACY_DEATH_TOUCH } from '../skills/death_touch';
import { ENEMY_AWARENESS as LEGACY_ENEMY_AWARENESS } from '../skills/enemy_awareness';
import { FIREBALL as LEGACY_FIREBALL } from '../skills/fireball';
import { FIREWALK as LEGACY_FIREWALK } from '../skills/firewalk';
import { FIREWALL as LEGACY_FIREWALL } from '../skills/firewall';
import { FLIGHT as LEGACY_FLIGHT } from '../skills/flight';
import { RAISE_DEAD as LEGACY_RAISE_DEAD } from '../skills/raise_dead';
import { KINETIC_TRI_TRAP as LEGACY_KINETIC_TRI_TRAP } from '../skills/kinetic_tri_trap';
import { MULTI_SHOOT as LEGACY_MULTI_SHOOT } from '../skills/multi_shoot';
import { ORACLE_SIGHT as LEGACY_ORACLE_SIGHT } from '../skills/oracle_sight';
import { PHASE_STEP as LEGACY_PHASE_STEP } from '../skills/phase_step_capability';
import { SHIELD_THROW as LEGACY_SHIELD_THROW } from '../skills/shield_throw';
import { SHADOW_STEP as LEGACY_SHADOW_STEP } from '../skills/shadow_step';
import { SNEAK_ATTACK as LEGACY_SNEAK_ATTACK } from '../skills/sneak_attack';
import { ARCHER_SHOT as LEGACY_ARCHER_SHOT } from '../skills/archer_shot';
import { SPEAR_THROW as LEGACY_SPEAR_THROW } from '../skills/spear_throw';
import { SENTINEL_BLAST as LEGACY_SENTINEL_BLAST } from '../skills/sentinel_blast';
import { SENTINEL_TELEGRAPH as LEGACY_SENTINEL_TELEGRAPH } from '../skills/sentinel_telegraph';
import { SET_TRAP as LEGACY_SET_TRAP } from '../skills/set_trap';
import { SMOKE_SCREEN as LEGACY_SMOKE_SCREEN } from '../skills/smoke_screen';
import { STANDARD_VISION as LEGACY_STANDARD_VISION } from '../skills/standard_vision';
import { TACTICAL_INSIGHT as LEGACY_TACTICAL_INSIGHT } from '../skills/tactical_insight';
import { THEME_HAZARDS as LEGACY_THEME_HAZARDS } from '../skills/theme_hazard';
import { TIME_BOMB as LEGACY_TIME_BOMB } from '../skills/time_bomb';
import { SWIFT_ROLL as LEGACY_SWIFT_ROLL } from '../skills/swift_roll';
import { VIBRATION_SENSE as LEGACY_VIBRATION_SENSE } from '../skills/vibration_sense';
import { VOLATILE_PAYLOAD as LEGACY_VOLATILE_PAYLOAD } from '../skills/volatile_payload';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { validateLineOfSight } from '../systems/validation';

const normalizePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

const sortPoints = (points: Point[]): Point[] =>
    [...points].map(normalizePoint).sort((left, right) =>
        left.q === right.q
            ? left.r === right.r
                ? left.s - right.s
                : left.r - right.r
            : left.q - right.q
    );

const normalizeEffectTarget = (
    target: string | Point,
    state: GameState,
    attacker: Actor,
    selectedTarget?: Point
): string | Point => {
    if (typeof target === 'string') {
        if (target === 'self') {
            return `actor:${attacker.id}`;
        }
        if (target === 'targetActor') {
            const selectedActor = selectedTarget ? getActorAt(state, selectedTarget) : undefined;
            return selectedActor ? `actor:${selectedActor.id}` : target;
        }
        return `actor:${target}`;
    }

    const actorAtPoint = getActorAt(state, target);
    return actorAtPoint ? `actor:${actorAtPoint.id}` : normalizePoint(target);
};

const normalizeEffect = (
    effect: AtomicEffect,
    state: GameState,
    attacker: Actor,
    selectedTarget?: Point
): Record<string, unknown> => {
    switch (effect.type) {
        case 'Damage':
            return {
                type: effect.type,
                target: normalizeEffectTarget(effect.target, state, attacker, selectedTarget),
                amount: effect.amount,
                reason: effect.reason,
                damageClass: effect.damageClass,
                damageSubClass: effect.damageSubClass,
                damageElement: effect.damageElement,
                leechRatio: effect.leechRatio
            };
        case 'PlaceFire':
            return {
                type: effect.type,
                position: normalizePoint(effect.position),
                duration: effect.duration
            };
        case 'Juice':
            return {
                type: effect.type,
                effectId: effect.effect,
                text: effect.text,
                duration: effect.duration,
                color: effect.color
            };
        case 'Message':
            return {
                type: effect.type,
                text: effect.text
            };
        case 'RemoveCorpse':
            return {
                type: effect.type,
                position: normalizePoint(effect.position)
            };
        case 'Displacement':
            return {
                type: effect.type,
                target: effect.target,
                destination: normalizePoint(effect.destination),
                simulatePath: effect.simulatePath,
                presentationKind: effect.presentationKind,
                pathStyle: effect.pathStyle,
                presentationSequenceId: effect.presentationSequenceId
            };
        case 'PlaceTrap':
            return {
                type: effect.type,
                position: normalizePoint(effect.position),
                ownerId: effect.ownerId,
                volatileCore: effect.volatileCore,
                chainReaction: effect.chainReaction,
                resetCooldown: effect.resetCooldown
            };
        case 'RemoveTrap':
            return {
                type: effect.type,
                position: effect.ownerId ? undefined : normalizePoint(effect.position),
                ownerId: effect.ownerId
            };
        case 'SetTrapCooldown':
            return {
                type: effect.type,
                position: normalizePoint(effect.position),
                cooldown: effect.cooldown,
                ownerId: effect.ownerId
            };
        case 'ApplyStatus':
            return {
                type: effect.type,
                target: typeof effect.target === 'string'
                    ? normalizeEffectTarget(effect.target, state, attacker, selectedTarget)
                    : normalizePoint(effect.target),
                status: effect.status,
                duration: effect.duration
            };
        case 'ApplyAilment':
            return {
                type: effect.type,
                target: normalizeEffectTarget(effect.target, state, attacker, selectedTarget),
                ailment: effect.ailment,
                skillMultiplier: effect.skillMultiplier,
                baseDeposit: effect.baseDeposit
            };
        case 'SpawnActor':
            return {
                type: effect.type,
                actor: {
                    id: effect.actor.id,
                    subtype: effect.actor.subtype,
                    factionId: effect.actor.factionId,
                    position: normalizePoint(effect.actor.position),
                    speed: effect.actor.speed,
                    weightClass: effect.actor.weightClass,
                    armorBurdenTier: effect.actor.armorBurdenTier,
                    activeSkillIds: effect.actor.activeSkills.map(skill => skill.id).sort(),
                    statusEffects: effect.actor.statusEffects
                        .map(status => ({
                            type: status.type,
                            duration: status.duration,
                            tickWindow: status.tickWindow
                    }))
                        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
                }
            };
        case 'SpawnItem':
            return {
                type: effect.type,
                itemType: effect.itemType,
                position: normalizePoint(effect.position)
            };
        case 'PickupShield':
        case 'PickupSpear':
            return {
                type: effect.type,
                position: effect.position ? normalizePoint(effect.position) : undefined
            };
        case 'ModifyCooldown':
            return {
                type: effect.type,
                skillId: effect.skillId,
                amount: effect.amount,
                setExact: effect.setExact
            };
        case 'UpdateCompanionState':
            return {
                type: effect.type,
                target: effect.target,
                mode: effect.mode,
                markTarget: effect.markTarget,
                orbitStep: effect.orbitStep,
                apexStrikeCooldown: effect.apexStrikeCooldown,
                healCooldown: effect.healCooldown,
                keenSight: effect.keenSight,
                twinTalons: effect.twinTalons,
                apexPredator: effect.apexPredator
            };
        case 'UpdateBehaviorState':
            return {
                type: effect.type,
                target: effect.target,
                overlays: effect.overlays,
                anchorActorId: effect.anchorActorId,
                anchorPoint: effect.anchorPoint,
                clearOverlays: effect.clearOverlays
            };
        default:
            return effect as unknown as Record<string, unknown>;
    }
};

const normalizeEffects = (
    effects: AtomicEffect[],
    state: GameState,
    attacker: Actor,
    selectedTarget?: Point
): Array<Record<string, unknown>> =>
    effects
        .filter(effect => effect.type !== 'Message')
        .map(effect => normalizeEffect(effect, state, attacker, selectedTarget))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

const normalizeConsumesTurn = (
    result: { consumesTurn?: boolean; effects: AtomicEffect[] }
): boolean => result.consumesTurn ?? result.effects.length > 0;

const placeWall = (state: GameState, position: Point): void => {
    state.tiles.set(pointToKey(position), {
        baseId: 'WALL',
        position,
        traits: new Set(['BLOCKS_LOS', 'BLOCKS_MOVEMENT']),
        effects: []
    });
};

type SharedCohortCase = {
    buildState: () => { state: GameState; attacker: Actor; target?: Point; activeUpgrades?: string[]; context?: Record<string, any> };
    expectedRngConsumption?: number;
};

type LegacyCohortCase = SharedCohortCase & {
    skillId:
        | 'ABSORB_FIRE'
        | 'AUTO_ATTACK'
        | 'BASIC_ATTACK'
        | 'BASIC_MOVE'
        | 'BOMB_TOSS'
        | 'CORPSE_EXPLOSION'
        | 'DEATH_TOUCH'
        | 'FALCON_APEX_STRIKE'
        | 'FALCON_AUTO_ROOST'
        | 'FALCON_COMMAND'
        | 'FALCON_HEAL'
        | 'FALCON_PECK'
        | 'FALCON_SCOUT'
        | 'FIREBALL'
        | 'FIREWALK'
        | 'FIREWALL'
        | 'KINETIC_TRI_TRAP'
        | 'MULTI_SHOOT'
        | 'RAISE_DEAD'
        | 'SHIELD_THROW'
        | 'ARCHER_SHOT'
        | 'SPEAR_THROW'
        | 'SENTINEL_BLAST'
        | 'SENTINEL_TELEGRAPH'
        | 'SET_TRAP'
        | 'SHADOW_STEP'
        | 'THEME_HAZARDS'
        | 'SMOKE_SCREEN'
        | 'SNEAK_ATTACK'
        | 'TIME_BOMB'
        | 'SWIFT_ROLL'
        | 'VOLATILE_PAYLOAD';
    legacy: SkillDefinition;
    runtimeContract?: never;
};

type RuntimeOnlyCohortCase = SharedCohortCase & {
    skillId: 'METEOR_IMPACT' | 'TORNADO_KICK';
    legacy?: never;
    runtimeContract: (args: {
        runtime: SkillDefinition | undefined;
        state: GameState;
        attacker: Actor;
        target?: Point;
        activeUpgrades: string[];
    }) => void;
};

type CohortCase = LegacyCohortCase | RuntimeOnlyCohortCase;

const cohortCases: CohortCase[] = [
    {
        skillId: 'ABSORB_FIRE',
        legacy: LEGACY_ABSORB_FIRE,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['ABSORB_FIRE']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker
            };
        }
    },
    {
        skillId: 'AUTO_ATTACK',
        legacy: LEGACY_AUTO_ATTACK,
        buildState: () => {
            const attacker = createPlayer({
                position: p(4, 5),
                speed: 10,
                skills: ['AUTO_ATTACK']
            });
            const persistent = createEnemy({
                id: 'persistent_foe',
                subtype: 'footman',
                position: p(5, 5),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const newNeighbor = createEnemy({
                id: 'new_neighbor',
                subtype: 'footman',
                position: p(4, 7),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const formerNeighbor = createEnemy({
                id: 'former_neighbor',
                subtype: 'footman',
                position: p(5, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [persistent, newNeighbor, formerNeighbor] });
            return {
                state,
                attacker,
                target: attacker.position,
                context: {
                    previousNeighbors: [persistent.position, formerNeighbor.position],
                    attackerTurnStartPosition: p(4, 5),
                    persistentTargetIds: ['persistent_foe', 'former_neighbor']
                }
            };
        }
    },
    {
        skillId: 'BASIC_ATTACK',
        legacy: LEGACY_BASIC_ATTACK,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['BASIC_ATTACK', 'SPEAR_THROW']
            });
            attacker.previousPosition = p(3, 3);
            const enemy = createEnemy({
                id: 'basic-attack-target',
                subtype: 'footman',
                position: p(4, 3),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [enemy] });
            state.hasSpear = true;
            return {
                state,
                attacker,
                target: enemy.position,
                activeUpgrades: ['EXTENDED_REACH', 'POWER_STRIKE', 'VAMPIRIC']
            };
        }
    },
    {
        skillId: 'BASIC_MOVE',
        legacy: LEGACY_BASIC_MOVE,
        buildState: () => {
            const attacker = createPlayer({
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
            ally.factionId = attacker.factionId;
            const blocker = createEnemy({
                id: 'basic-move-blocker',
                subtype: 'skeleton',
                position: p(5, 2),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [ally, blocker] }),
                attacker,
                target: p(5, 3)
            };
        }
    },
    {
        skillId: 'BOMB_TOSS',
        legacy: LEGACY_BOMB_TOSS,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['BOMB_TOSS']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target: p(4, 3)
            };
        }
    },
    {
        skillId: 'CORPSE_EXPLOSION',
        legacy: LEGACY_CORPSE_EXPLOSION,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['CORPSE_EXPLOSION']
            });
            const target = p(4, 4);
            const neighbor = createEnemy({
                id: 'corpse-neighbor',
                subtype: 'skeleton',
                position: p(5, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [neighbor] });
            state.tiles.set(pointToKey(target), {
                baseId: 'STONE',
                position: target,
                traits: new Set(['WALKABLE', 'CORPSE']),
                effects: []
            });
            return {
                state,
                attacker,
                target
            };
        }
    },
    {
        skillId: 'KINETIC_TRI_TRAP',
        legacy: LEGACY_KINETIC_TRI_TRAP,
        expectedRngConsumption: 3,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['KINETIC_TRI_TRAP']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target: attacker.position,
                activeUpgrades: ['VOLATILE_CORE', 'TRAP_CHAIN_REACTION', 'QUICK_RELOAD']
            };
        }
    },
    {
        skillId: 'DEATH_TOUCH',
        legacy: LEGACY_DEATH_TOUCH,
        buildState: () => {
            const attacker = createPlayer({
                position: p(2, 2),
                speed: 10,
                skills: ['DEATH_TOUCH']
            });
            const enemy = createEnemy({
                id: 'death-touch-target',
                subtype: 'skeleton',
                position: p(3, 2),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [enemy] }),
                attacker,
                target: enemy.position
            };
        }
    },
    {
        skillId: 'METEOR_IMPACT',
        runtimeContract: ({ runtime, state, attacker, target }) => {
            expect(runtime?.id).toBe('METEOR_IMPACT');
            const initialTargets = sortPoints(runtime?.getValidTargets?.(state, attacker.position) || []);
            expect(initialTargets).toContainEqual(target!);
            expect(initialTargets).not.toContainEqual(p(3, 3));

            const blockedState = { ...state, tiles: new Map(state.tiles) } as GameState;
            placeWall(blockedState, p(2, 3));
            const blockedTargets = sortPoints(runtime?.getValidTargets?.(blockedState, attacker.position) || []);
            expect(blockedTargets).not.toContainEqual(target!);

            const result = runtime?.execute(state, attacker, target);
            expect(result?.consumesTurn).toBe(true);
            expect(result?.effects.some(effect =>
                effect.type === 'Displacement'
                && effect.target === 'self'
                && effect.destination.q === target?.q
                && effect.destination.r === target?.r
                && effect.destination.s === target?.s
            )).toBe(true);
            expect(result?.effects.some(effect =>
                effect.type === 'Damage'
                && effect.target === 'enemy-axial'
                && effect.amount === 5
                && effect.damageElement === 'kinetic'
            )).toBe(true);
            expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Meteor Impact'))).toBe(true);
        },
        buildState: () => {
            const attacker = createPlayer({
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
            return {
                state: createMockState({ player: attacker, enemies: [axialEnemy, diagonalEnemy] }),
                attacker,
                target: axialEnemy.position
            };
        }
    },
    {
        skillId: 'MULTI_SHOOT',
        legacy: LEGACY_MULTI_SHOOT,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['MULTI_SHOOT']
            });
            const primary = createEnemy({
                id: 'multi-shoot-primary',
                subtype: 'footman',
                position: p(3, 1),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const splash = createEnemy({
                id: 'multi-shoot-splash',
                subtype: 'footman',
                position: p(4, 1),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [primary, splash] }),
                attacker,
                target: primary.position
            };
        }
    },
    {
        skillId: 'FALCON_COMMAND',
        legacy: LEGACY_FALCON_COMMAND,
        buildState: () => {
            const attacker = createPlayer({
                position: p(4, 4),
                speed: 10,
                skills: ['FALCON_COMMAND']
            });
            const falcon = createCompanion({
                companionType: 'falcon',
                ownerId: attacker.id,
                ownerFactionId: attacker.factionId,
                position: p(3, 4)
            });
            falcon.id = 'falcon-command-parity';
            const prey = createEnemy({
                id: 'falcon-command-prey',
                subtype: 'enemy',
                position: p(4, 2),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [falcon, prey] });
            state.companions = [falcon];
            return {
                state,
                attacker,
                target: prey.position
            };
        }
    },
    {
        skillId: 'TORNADO_KICK',
        runtimeContract: ({ runtime, state, attacker, target }) => {
            expect(runtime?.id).toBe('TORNADO_KICK');
            const runtimeTargets = sortPoints(runtime?.getValidTargets?.(state, attacker.position) || []);
            expect(runtimeTargets).toContainEqual(target!);

            const result = runtime?.execute(state, attacker, target);
            const applyForceEffects = result?.effects.filter(effect => effect.type === 'ApplyForce') || [];

            expect(result?.consumesTurn).toBe(true);
            expect(applyForceEffects).toHaveLength(2);
            expect(applyForceEffects[0]).toMatchObject({ mode: 'pull', target: 'enemy-adjacent' });
            expect(applyForceEffects[1]).toMatchObject({ mode: 'push', target: 'enemy-adjacent' });
            expect(result?.effects.some(effect =>
                effect.type === 'Damage'
                && effect.target === 'enemy-adjacent'
                && effect.amount === 3
            )).toBe(true);
            expect(result?.effects.some(effect => effect.type === 'Message' && effect.text.includes('Tornado Kick'))).toBe(true);
        },
        buildState: () => {
            const attacker = createPlayer({
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
            return {
                state: createMockState({ player: attacker, enemies: [enemy] }),
                attacker,
                target: enemy.position
            };
        }
    },
    {
        skillId: 'FALCON_AUTO_ROOST',
        legacy: LEGACY_FALCON_AUTO_ROOST,
        buildState: () => {
            const player = createPlayer({
                position: p(4, 4),
                speed: 10,
                skills: ['FALCON_COMMAND']
            });
            const attacker = createCompanion({
                companionType: 'falcon',
                ownerId: player.id,
                ownerFactionId: player.factionId,
                position: p(3, 4)
            });
            attacker.id = 'falcon-auto-roost';
            attacker.companionState = {
                ...attacker.companionState,
                mode: 'predator',
                markTarget: 'lost-prey'
            };
            const state = createMockState({ player, enemies: [attacker] });
            state.companions = [attacker];
            return {
                state,
                attacker,
                target: attacker.position
            };
        }
    },
    {
        skillId: 'FALCON_SCOUT',
        legacy: LEGACY_FALCON_SCOUT,
        buildState: () => {
            const player = createPlayer({
                position: p(4, 4),
                speed: 10,
                skills: ['FALCON_COMMAND']
            });
            const attacker = createCompanion({
                companionType: 'falcon',
                ownerId: player.id,
                ownerFactionId: player.factionId,
                position: p(3, 4)
            });
            attacker.id = 'falcon-scout';
            attacker.companionState = {
                ...attacker.companionState,
                mode: 'scout',
                markTarget: p(3, 2)
            };
            attacker.behaviorState = {
                ...(attacker.behaviorState || { overlays: [] }),
                anchorPoint: p(3, 2)
            };
            const state = createMockState({ player, enemies: [attacker] });
            state.companions = [attacker];
            return {
                state,
                attacker,
                target: p(3, 2)
            };
        }
    },
    {
        skillId: 'FALCON_PECK',
        legacy: LEGACY_FALCON_PECK,
        buildState: () => {
            const player = createPlayer({
                position: p(4, 4),
                speed: 10,
                skills: ['FALCON_COMMAND']
            });
            const attacker = createCompanion({
                companionType: 'falcon',
                ownerId: player.id,
                ownerFactionId: player.factionId,
                position: p(3, 4)
            });
            attacker.id = 'falcon-peck';
            const prey = createEnemy({
                id: 'falcon-peck-prey',
                subtype: 'enemy',
                position: p(3, 3),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player, enemies: [attacker, prey] });
            state.companions = [attacker];
            return {
                state,
                attacker,
                target: prey.position
            };
        }
    },
    {
        skillId: 'FALCON_APEX_STRIKE',
        legacy: LEGACY_FALCON_APEX_STRIKE,
        buildState: () => {
            const player = createPlayer({
                position: p(8, 8),
                speed: 10,
                skills: ['FALCON_COMMAND']
            });
            const attacker = createCompanion({
                companionType: 'falcon',
                ownerId: player.id,
                ownerFactionId: player.factionId,
                position: p(3, 4)
            });
            attacker.id = 'falcon-apex';
            attacker.companionState = {
                ...attacker.companionState,
                mode: attacker.companionState?.mode || 'roost',
                apexStrikeCooldown: 0
            };
            const prey = createEnemy({
                id: 'falcon-apex-prey',
                subtype: 'enemy',
                position: p(3, 1),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player, enemies: [attacker, prey] });
            state.companions = [attacker];
            return {
                state,
                attacker,
                target: prey.position
            };
        }
    },
    {
        skillId: 'FALCON_HEAL',
        legacy: LEGACY_FALCON_HEAL,
        buildState: () => {
            const player = createPlayer({
                position: p(4, 4),
                speed: 10,
                skills: ['FALCON_COMMAND']
            });
            const attacker = createCompanion({
                companionType: 'falcon',
                ownerId: player.id,
                ownerFactionId: player.factionId,
                position: p(3, 4)
            });
            attacker.id = 'falcon-heal';
            attacker.companionState = {
                ...attacker.companionState,
                mode: attacker.companionState?.mode || 'roost',
                healCooldown: 0
            };
            const state = createMockState({ player, enemies: [attacker] });
            state.companions = [attacker];
            return {
                state,
                attacker,
                target: player.position
            };
        }
    },
    {
        skillId: 'ARCHER_SHOT',
        legacy: LEGACY_ARCHER_SHOT,
        expectedRngConsumption: 0,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['ARCHER_SHOT']
            });
            const enemy = createEnemy({
                id: 'archer-shot-target',
                subtype: 'skeleton',
                position: p(3, 5),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [enemy] }),
                attacker,
                target: enemy.position
            };
        }
    },
    {
        skillId: 'FIREBALL',
        legacy: LEGACY_FIREBALL,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['FIREBALL']
            });
            const target = p(3, 5);
            const primary = createEnemy({
                id: 'fireball-primary',
                subtype: 'skeleton',
                position: target,
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const neighbor = createEnemy({
                id: 'fireball-neighbor',
                subtype: 'skeleton',
                position: p(4, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [primary, neighbor] }),
                attacker,
                target
            };
        }
    },
    {
        skillId: 'FIREWALK',
        legacy: LEGACY_FIREWALK,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['FIREWALK']
            });
            const target = p(4, 3);
            const state = createMockState({ player: attacker, enemies: [] });
            state.tiles.set(pointToKey(target), {
                baseId: 'STONE',
                position: target,
                traits: new Set(['WALKABLE']),
                effects: [{ id: 'FIRE', duration: 2, potency: 1 }]
            });
            return {
                state,
                attacker,
                target
            };
        }
    },
    {
        skillId: 'FIREWALL',
        legacy: LEGACY_FIREWALL,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['FIREWALL']
            });
            const target = p(3, 5);
            const wallTile = p(2, 6);
            const impactedEnemy = createEnemy({
                id: 'firewall-hit',
                subtype: 'skeleton',
                position: p(4, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const blockedEnemy = createEnemy({
                id: 'firewall-blocked',
                subtype: 'skeleton',
                position: wallTile,
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [impactedEnemy, blockedEnemy] });
            state.tiles.set(pointToKey(wallTile), {
                baseId: 'WALL',
                position: wallTile,
                traits: new Set(['BLOCKS_LOS', 'BLOCKS_MOVEMENT']),
                effects: []
            });
            return {
                state,
                attacker,
                target
            };
        }
    },
    {
        skillId: 'RAISE_DEAD',
        legacy: LEGACY_RAISE_DEAD,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['RAISE_DEAD']
            });
            const target = p(4, 3);
            const ally = createEnemy({
                id: 'raise-dead-ally',
                subtype: 'skeleton',
                position: target,
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            ally.factionId = attacker.factionId;
            const state = createMockState({ player: attacker, enemies: [ally] });
            state.tiles.set(pointToKey(target), {
                baseId: 'STONE',
                position: target,
                traits: new Set(['WALKABLE', 'CORPSE']),
                effects: []
            });
            return {
                state,
                attacker,
                target
            };
        }
    },
    {
        skillId: 'SHIELD_THROW',
        legacy: LEGACY_SHIELD_THROW,
        expectedRngConsumption: 0,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SHIELD_THROW']
            });
            const enemy = createEnemy({
                id: 'shield-throw-target',
                subtype: 'footman',
                position: p(3, 1),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [enemy] }),
                attacker,
                target: enemy.position
            };
        }
    },
    {
        skillId: 'SHADOW_STEP',
        legacy: LEGACY_SHADOW_STEP,
        buildState: () => {
            const attacker = createPlayer({
                position: p(4, 4),
                speed: 10,
                skills: ['SHADOW_STEP']
            });
            attacker.stealthCounter = 2;
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target: p(5, 4)
            };
        }
    },
    {
        skillId: 'SPEAR_THROW',
        legacy: LEGACY_SPEAR_THROW,
        expectedRngConsumption: 0,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SPEAR_THROW']
            });
            const enemy = createEnemy({
                id: 'spear-throw-target',
                subtype: 'enemy',
                position: p(3, 1),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [enemy] });
            state.hasSpear = true;
            state.spearPosition = undefined;
            return {
                state,
                attacker,
                target: enemy.position
            };
        }
    },
    {
        skillId: 'SMOKE_SCREEN',
        legacy: LEGACY_SMOKE_SCREEN,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SMOKE_SCREEN']
            });
            const nearbyEnemy = createEnemy({
                id: 'smoke-screen-nearby',
                subtype: 'footman',
                position: p(4, 3),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [nearbyEnemy] }),
                attacker,
                target: attacker.position,
                activeUpgrades: ['BLINDING_SMOKE']
            };
        }
    },
    {
        skillId: 'SNEAK_ATTACK',
        legacy: LEGACY_SNEAK_ATTACK,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SNEAK_ATTACK']
            });
            attacker.stealthCounter = 2;
            const enemy = createEnemy({
                id: 'sneak-attack-target',
                subtype: 'footman',
                position: p(4, 3),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [enemy] }),
                attacker,
                target: enemy.position
            };
        }
    },
    {
        skillId: 'SENTINEL_BLAST',
        legacy: LEGACY_SENTINEL_BLAST,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SENTINEL_BLAST']
            });
            const target = p(3, 4);
            const primary = createEnemy({
                id: 'sentinel-blast-primary',
                subtype: 'sentinel',
                position: target,
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const neighbor = createEnemy({
                id: 'sentinel-blast-neighbor',
                subtype: 'skeleton',
                position: p(4, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [primary, neighbor] }),
                attacker,
                target
            };
        }
    },
    {
        skillId: 'SENTINEL_TELEGRAPH',
        legacy: LEGACY_SENTINEL_TELEGRAPH,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SENTINEL_TELEGRAPH']
            });
            const target = p(3, 5);
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target
            };
        }
    },
    {
        skillId: 'SET_TRAP',
        legacy: LEGACY_SET_TRAP,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SET_TRAP']
            });
            const target = p(4, 3);
            const occupied = createEnemy({
                id: 'set-trap-occupied',
                subtype: 'skeleton',
                position: target,
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [occupied] }),
                attacker,
                target
            };
        }
    },
    {
        skillId: 'THEME_HAZARDS',
        legacy: LEGACY_THEME_HAZARDS,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['THEME_HAZARDS']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker
            };
        }
    },
    {
        skillId: 'TIME_BOMB',
        legacy: LEGACY_TIME_BOMB,
        buildState: () => {
            const player = createPlayer({
                position: p(2, 2),
                speed: 10,
                skills: []
            });
            const attacker = createEnemy({
                id: 'time-bomb-runtime',
                subtype: 'bomb',
                position: p(4, 4),
                speed: 1,
                skills: ['TIME_BOMB']
            });
            attacker.statusEffects = [{
                id: 'TIME_BOMB',
                type: 'time_bomb',
                duration: 1,
                tickWindow: 'END_OF_TURN'
            }];
            const state = createMockState({ player, enemies: [attacker] });
            return {
                state,
                attacker,
                target: attacker.position
            };
        }
    },
    {
        skillId: 'SWIFT_ROLL',
        legacy: LEGACY_SWIFT_ROLL,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SWIFT_ROLL']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target: p(4, 3)
            };
        }
    },
    {
        skillId: 'VOLATILE_PAYLOAD',
        legacy: LEGACY_VOLATILE_PAYLOAD,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['VOLATILE_PAYLOAD']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target: attacker.position
            };
        }
    },
];

describe('runtime production cohort parity', () => {
    cohortCases.forEach(testCase => {
        it(`${testCase.skillId} matches legacy targets and execution`, () => {
            const runtime = SkillRuntimeRegistry.getLegacy(testCase.skillId) || SkillRegistry.get(testCase.skillId);
            const legacyCase = testCase.buildState();
            const runtimeCase = testCase.buildState();
            const runtimeTargets = sortPoints(runtime?.getValidTargets?.(runtimeCase.state, runtimeCase.attacker.position) || []);

            expect(runtime?.id).toBe(testCase.skillId);
            if (testCase.legacy) {
                const { state: legacyState, attacker: legacyAttacker, target: legacyTarget, activeUpgrades: legacyActiveUpgrades = [], context: legacyContext = {} } = legacyCase;
                const { state: runtimeState, attacker: runtimeAttacker, target: runtimeTarget, activeUpgrades: runtimeActiveUpgrades = [], context: runtimeContext = {} } = runtimeCase;
                const legacyTargets = sortPoints(testCase.legacy.getValidTargets?.(legacyState, legacyAttacker.position) || []);
                const legacyExecution = testCase.legacy.execute(legacyState, legacyAttacker, legacyTarget, legacyActiveUpgrades, legacyContext);
                const runtimeExecution = runtime?.execute(runtimeState, runtimeAttacker, runtimeTarget, runtimeActiveUpgrades, runtimeContext);

                expect(runtimeTargets).toEqual(legacyTargets);
                expect(runtimeExecution?.messages).toEqual(legacyExecution.messages);
                expect(normalizeConsumesTurn(runtimeExecution || { effects: [] })).toBe(
                    normalizeConsumesTurn(legacyExecution)
                );
                expect(
                    normalizeEffects(runtimeExecution?.effects || [], runtimeState, runtimeAttacker, runtimeTarget)
                ).toEqual(
                    normalizeEffects(legacyExecution.effects, legacyState, legacyAttacker, legacyTarget)
                );
                if (typeof testCase.expectedRngConsumption === 'number') {
                    expect(runtimeExecution?.rngConsumption ?? 0).toBe(testCase.expectedRngConsumption);
                }
            } else {
                const { state, attacker, target, activeUpgrades = [] } = runtimeCase;
                testCase.runtimeContract({
                    runtime,
                    state,
                    attacker,
                    target,
                    activeUpgrades
                });
            }
        });
    });

    it('SPEAR_THROW recall mode matches legacy execution', () => {
        const runtime = SkillRegistry.get('SPEAR_THROW');
        const attacker = createPlayer({
            position: p(3, 3),
            speed: 10,
            skills: ['SPEAR_THROW']
        });
        const enemy = createEnemy({
            id: 'spear-recall-target',
            subtype: 'enemy',
            position: p(3, 2),
            speed: 1,
            skills: ['BASIC_ATTACK']
        });
        const state = createMockState({ player: attacker, enemies: [enemy] });
        state.hasSpear = false;
        state.spearPosition = p(3, 1);
        const activeUpgrades = ['SPEAR_CLEAVE'];

        const legacyExecution = LEGACY_SPEAR_THROW.execute(state, attacker, undefined, activeUpgrades);
        const runtimeExecution = runtime?.execute(state, attacker, attacker.position, activeUpgrades);

        expect(runtime?.name).toBeTypeOf('function');
        expect((runtime?.name as (runtimeState: GameState) => string)(state)).toBe('Recall Spear');
        expect(runtimeExecution?.messages).toEqual(legacyExecution.messages);
        expect(normalizeConsumesTurn(runtimeExecution || { effects: [] })).toBe(
            normalizeConsumesTurn(legacyExecution)
        );
        expect(
            normalizeEffects(runtimeExecution?.effects || [], state, attacker, state.spearPosition || attacker.position)
        ).toEqual(
            normalizeEffects(legacyExecution.effects, state, attacker, state.spearPosition || attacker.position)
        );
        expect(runtimeExecution?.rngConsumption ?? 0).toBe(0);
    });

    it('attaches existing scenarios to runtime-backed skills', () => {
        const runtimeArcherShot = SkillRuntimeRegistry.getLegacy('ARCHER_SHOT') || SkillRegistry.get('ARCHER_SHOT');
        const runtimeAutoAttack = SkillRuntimeRegistry.getLegacy('AUTO_ATTACK') || SkillRegistry.get('AUTO_ATTACK');
        const runtimeBasicAttack = SkillRuntimeRegistry.getLegacy('BASIC_ATTACK') || SkillRegistry.get('BASIC_ATTACK');
        const runtimeBasicMove = SkillRuntimeRegistry.getLegacy('BASIC_MOVE') || SkillRegistry.get('BASIC_MOVE');
        const runtimeCorpseExplosion = SkillRuntimeRegistry.getLegacy('CORPSE_EXPLOSION') || SkillRegistry.get('CORPSE_EXPLOSION');
        const runtimeBombToss = SkillRuntimeRegistry.getLegacy('BOMB_TOSS') || SkillRegistry.get('BOMB_TOSS');
        const runtimeFireball = SkillRuntimeRegistry.getLegacy('FIREBALL') || SkillRegistry.get('FIREBALL');
        const runtimeFirewalk = SkillRuntimeRegistry.getLegacy('FIREWALK') || SkillRegistry.get('FIREWALK');
        const runtimeRaiseDead = SkillRuntimeRegistry.getLegacy('RAISE_DEAD') || SkillRegistry.get('RAISE_DEAD');
        const runtimeFalconApexStrike = SkillRuntimeRegistry.getLegacy('FALCON_APEX_STRIKE') || SkillRegistry.get('FALCON_APEX_STRIKE');
        const runtimeFalconAutoRoost = SkillRuntimeRegistry.getLegacy('FALCON_AUTO_ROOST') || SkillRegistry.get('FALCON_AUTO_ROOST');
        const runtimeFalconCommand = SkillRuntimeRegistry.getLegacy('FALCON_COMMAND') || SkillRegistry.get('FALCON_COMMAND');
        const runtimeFalconHeal = SkillRuntimeRegistry.getLegacy('FALCON_HEAL') || SkillRegistry.get('FALCON_HEAL');
        const runtimeFalconPeck = SkillRuntimeRegistry.getLegacy('FALCON_PECK') || SkillRegistry.get('FALCON_PECK');
        const runtimeFalconScout = SkillRuntimeRegistry.getLegacy('FALCON_SCOUT') || SkillRegistry.get('FALCON_SCOUT');
        const runtimeSentinelBlast = SkillRuntimeRegistry.getLegacy('SENTINEL_BLAST') || SkillRegistry.get('SENTINEL_BLAST');
        const runtimeSentinelTelegraph = SkillRuntimeRegistry.getLegacy('SENTINEL_TELEGRAPH') || SkillRegistry.get('SENTINEL_TELEGRAPH');
        const runtimeSetTrap = SkillRuntimeRegistry.getLegacy('SET_TRAP') || SkillRegistry.get('SET_TRAP');
        const runtimeFirewall = SkillRuntimeRegistry.getLegacy('FIREWALL') || SkillRegistry.get('FIREWALL');
        const runtimeKineticTriTrap = SkillRuntimeRegistry.getLegacy('KINETIC_TRI_TRAP') || SkillRegistry.get('KINETIC_TRI_TRAP');
        const runtimeAbsorbFire = SkillRuntimeRegistry.getLegacy('ABSORB_FIRE') || SkillRegistry.get('ABSORB_FIRE');
        const runtimeShieldThrow = SkillRuntimeRegistry.getLegacy('SHIELD_THROW') || SkillRegistry.get('SHIELD_THROW');
        const runtimeSpearThrow = SkillRuntimeRegistry.getLegacy('SPEAR_THROW') || SkillRegistry.get('SPEAR_THROW');
        const runtimeThemeHazards = SkillRuntimeRegistry.getLegacy('THEME_HAZARDS') || SkillRegistry.get('THEME_HAZARDS');
        const runtimeTimeBomb = SkillRuntimeRegistry.getLegacy('TIME_BOMB') || SkillRegistry.get('TIME_BOMB');
        const runtimeVolatilePayload = SkillRuntimeRegistry.getLegacy('VOLATILE_PAYLOAD') || SkillRegistry.get('VOLATILE_PAYLOAD');
        const runtimeMeteorImpact = SkillRuntimeRegistry.getLegacy('METEOR_IMPACT') || SkillRegistry.get('METEOR_IMPACT');
        const runtimeMultiShoot = SkillRuntimeRegistry.getLegacy('MULTI_SHOOT') || SkillRegistry.get('MULTI_SHOOT');
        const runtimeTornadoKick = SkillRuntimeRegistry.getLegacy('TORNADO_KICK') || SkillRegistry.get('TORNADO_KICK');

        expect(runtimeArcherShot?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_ARCHER_SHOT.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeAutoAttack?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_AUTO_ATTACK.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeBasicAttack?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_BASIC_ATTACK.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeBasicMove?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_BASIC_MOVE.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeCorpseExplosion?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_CORPSE_EXPLOSION.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeBombToss?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_BOMB_TOSS.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFireball?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_FIREBALL.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFirewalk?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_FIREWALK.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFalconApexStrike?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_FALCON_APEX_STRIKE.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFalconAutoRoost?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_FALCON_AUTO_ROOST.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFalconCommand?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_FALCON_COMMAND.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFalconHeal?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_FALCON_HEAL.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFalconPeck?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_FALCON_PECK.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFalconScout?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_FALCON_SCOUT.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeFirewall?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_FIREWALL.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeKineticTriTrap?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_KINETIC_TRI_TRAP.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeRaiseDead?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_RAISE_DEAD.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeShieldThrow?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_SHIELD_THROW.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeSpearThrow?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_SPEAR_THROW.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeSentinelBlast?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_SENTINEL_BLAST.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeSentinelTelegraph?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_SENTINEL_TELEGRAPH.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeSetTrap?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_SET_TRAP.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeAbsorbFire?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_ABSORB_FIRE.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeThemeHazards?.scenarios?.map(scenario => scenario.id)).toEqual(
            (LEGACY_THEME_HAZARDS.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeTimeBomb?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_TIME_BOMB.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeVolatilePayload?.scenarios?.map(scenario => scenario.id) || []).toEqual(
            (LEGACY_VOLATILE_PAYLOAD.scenarios || []).map(scenario => scenario.id)
        );
        expect(runtimeMeteorImpact?.scenarios?.map(scenario => scenario.id) || []).toEqual([
            'meteor_impact_leap_and_slam',
            'meteor_impact_rejects_blocked_lane'
        ]);
        expect(runtimeMultiShoot?.scenarios?.map(scenario => scenario.id) || []).toEqual([
            'multi_shoot_hits_target_and_neighbors',
            'multi_shoot_rejects_non_axial_target'
        ]);
        expect(runtimeTornadoKick?.scenarios?.map(scenario => scenario.id) || []).toEqual([
            'tornado_kick_shifts_target',
            'tornado_kick_stops_on_wall_collision',
            'tornado_kick_rejects_non_adjacent_target'
        ]);
    });
});

describe('runtime capability cohort parity', () => {
    const expectInformationParity = (
        skillId: string,
        legacySkill: SkillDefinition,
        query: Parameters<NonNullable<NonNullable<SkillDefinition['capabilities']>['information']>[number]['resolve']>[0]
    ): void => {
        const runtimeSkill = SkillRuntimeRegistry.getLegacy(skillId) || SkillRegistry.get(skillId);
        const legacyProvider = legacySkill.capabilities?.information?.[0];
        const runtimeProvider = runtimeSkill?.capabilities?.information?.[0];

        expect(runtimeProvider?.providerId).toBe(legacyProvider?.providerId);
        expect(runtimeProvider?.resolve(query as any)).toEqual(legacyProvider?.resolve(query as any));
    };

    const expectSenseParity = (
        skillId: string,
        legacySkill: SkillDefinition,
        query: Parameters<NonNullable<NonNullable<SkillDefinition['capabilities']>['senses']>[number]['resolve']>[0]
    ): void => {
        const runtimeSkill = SkillRuntimeRegistry.getLegacy(skillId) || SkillRegistry.get(skillId);
        const legacyProvider = legacySkill.capabilities?.senses?.[0];
        const runtimeProvider = runtimeSkill?.capabilities?.senses?.[0];

        expect(runtimeProvider?.providerId).toBe(legacyProvider?.providerId);
        expect(runtimeProvider?.resolve(query as any)).toEqual(legacyProvider?.resolve(query as any));
    };

    const expectMovementParity = (
        skillId: string,
        legacySkill: SkillDefinition,
        query: Parameters<NonNullable<NonNullable<SkillDefinition['capabilities']>['movement']>[number]['resolve']>[0]
    ): void => {
        const runtimeSkill = SkillRuntimeRegistry.getLegacy(skillId) || SkillRegistry.get(skillId);
        const legacyProvider = legacySkill.capabilities?.movement?.[0];
        const runtimeProvider = runtimeSkill?.capabilities?.movement?.[0];

        expect(runtimeProvider?.providerId).toBe(legacyProvider?.providerId);
        expect(runtimeProvider?.resolve(query as any)).toEqual(legacyProvider?.resolve(query as any));
    };

    it('matches legacy callback providers for runtime capability skills', () => {
        const infoState = createMockState({
            player: createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['BASIC_AWARENESS', 'COMBAT_ANALYSIS', 'TACTICAL_INSIGHT', 'ORACLE_SIGHT']
            }),
            enemies: [
                createEnemy({
                    id: 'cap-target-info',
                    subtype: 'footman',
                    position: p(3, 4),
                    speed: 1,
                    skills: ['BASIC_ATTACK']
                })
            ]
        });
        infoState.player.components = new Map([
            ['trinity', { type: 'trinity', body: 4, mind: 12, instinct: 12 }]
        ]);
        const infoTarget = infoState.enemies[0]!;

        expectInformationParity('BASIC_AWARENESS', LEGACY_BASIC_AWARENESS, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict'
        });
        expectInformationParity('COMBAT_ANALYSIS', LEGACY_COMBAT_ANALYSIS, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict'
        });
        expectInformationParity('TACTICAL_INSIGHT', LEGACY_TACTICAL_INSIGHT, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict'
        });
        expectInformationParity('ORACLE_SIGHT', LEGACY_ORACLE_SIGHT, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict',
            context: {
                topActionUtilities: [
                    { skillId: 'BASIC_ATTACK', score: 0.9 }
                ]
            }
        });

        const senseState = createMockState({
            player: createPlayer({
                position: p(2, 6),
                speed: 10,
                skills: ['STANDARD_VISION', 'ENEMY_AWARENESS', 'VIBRATION_SENSE']
            }),
            enemies: [
                createEnemy({
                    id: 'cap-target-sense',
                    subtype: 'footman',
                    position: p(2, 4),
                    speed: 1,
                    skills: ['BASIC_ATTACK']
                })
            ]
        });
        senseState.player.components = new Map([
            ['trinity', { type: 'trinity', body: 4, mind: 12, instinct: 12 }]
        ]);
        const senseTarget = senseState.enemies[0]!;
        senseTarget.previousPosition = p(2, 5);

        expectSenseParity('STANDARD_VISION', LEGACY_STANDARD_VISION, {
            state: senseState,
            observer: senseState.player,
            origin: senseState.player.position,
            target: senseTarget.position,
            targetActor: senseTarget,
            stopAtWalls: true,
            stopAtActors: true,
            stopAtLava: true,
            excludeActorId: senseState.player.id,
            distance: 2,
            context: {},
            evaluateLegacyLineOfSight: (overrides = {}) =>
                validateLineOfSight(senseState, senseState.player.position, senseTarget.position, {
                    observerActor: senseState.player,
                    excludeActorId: senseState.player.id,
                    ...overrides
                })
        });
        expectSenseParity('ENEMY_AWARENESS', LEGACY_ENEMY_AWARENESS, {
            state: senseState,
            observer: createEnemy({
                id: 'cap-observer-enemy',
                subtype: 'footman',
                position: p(2, 7),
                speed: 1,
                skills: ['ENEMY_AWARENESS']
            }),
            origin: p(2, 7),
            target: senseTarget.position,
            targetActor: senseTarget,
            stopAtWalls: true,
            stopAtActors: true,
            stopAtLava: true,
            excludeActorId: 'cap-observer-enemy',
            distance: 3,
            context: {},
            evaluateLegacyLineOfSight: (overrides = {}) =>
                validateLineOfSight(senseState, p(2, 7), senseTarget.position, {
                    observerActor: createEnemy({
                        id: 'cap-observer-enemy',
                        subtype: 'footman',
                        position: p(2, 7),
                        speed: 1,
                        skills: ['ENEMY_AWARENESS']
                    }),
                    excludeActorId: 'cap-observer-enemy',
                    ...overrides
                })
        });
        expectSenseParity('VIBRATION_SENSE', LEGACY_VIBRATION_SENSE, {
            state: senseState,
            observer: senseState.player,
            origin: senseState.player.position,
            target: senseTarget.position,
            targetActor: senseTarget,
            stopAtWalls: true,
            stopAtActors: true,
            stopAtLava: true,
            excludeActorId: senseState.player.id,
            distance: 2,
            context: {},
            evaluateLegacyLineOfSight: (overrides = {}) =>
                validateLineOfSight(senseState, senseState.player.position, senseTarget.position, {
                    observerActor: senseState.player,
                    excludeActorId: senseState.player.id,
                    ...overrides
                })
        });

        const movementActor = createPlayer({
            position: p(4, 4),
            speed: 10,
            skills: ['FLIGHT', 'BURROW', 'PHASE_STEP', 'BLIND_FIGHTING']
        });
        const movementState = createMockState({ player: movementActor, enemies: [] });
        expectMovementParity('FLIGHT', LEGACY_FLIGHT, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'FLIGHT',
            context: {}
        });
        expectMovementParity('BURROW', LEGACY_BURROW, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'BURROW',
            context: {}
        });
        expectMovementParity('PHASE_STEP', LEGACY_PHASE_STEP, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'PHASE_STEP',
            context: {}
        });
        expectMovementParity('BLIND_FIGHTING', LEGACY_BLIND_FIGHTING, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'BLIND_FIGHTING',
            context: {}
        });
    });
});
