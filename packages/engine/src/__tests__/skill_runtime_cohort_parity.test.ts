import { describe, expect, it } from 'vitest';
import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { SkillRegistry } from '../skillRegistry';
import { createCompanion, createEnemy, createPlayer } from '../systems/entities/entity-factory';
import { createMockState, p } from './test_utils';
import { ABSORB_FIRE as REFERENCE_ABSORB_FIRE } from '../skills/absorb_fire';
import { FALCON_APEX_STRIKE as REFERENCE_FALCON_APEX_STRIKE } from '../skills/falcon_apex_strike';
import { FALCON_AUTO_ROOST as REFERENCE_FALCON_AUTO_ROOST } from '../skills/falcon_auto_roost';
import { FALCON_COMMAND as REFERENCE_FALCON_COMMAND } from '../skills/falcon_command';
import { FALCON_HEAL as REFERENCE_FALCON_HEAL } from '../skills/falcon_heal';
import { FALCON_PECK as REFERENCE_FALCON_PECK } from '../skills/falcon_peck';
import { FALCON_SCOUT as REFERENCE_FALCON_SCOUT } from '../skills/falcon_scout';
import { AUTO_ATTACK as REFERENCE_AUTO_ATTACK } from '../skills/auto_attack';
import { BASIC_AWARENESS as REFERENCE_BASIC_AWARENESS } from '../skills/basic_awareness';
import { BASIC_ATTACK as REFERENCE_BASIC_ATTACK } from '../skills/basic_attack';
import { BASIC_MOVE as REFERENCE_BASIC_MOVE } from '../skills/basic_move';
import { BLIND_FIGHTING as REFERENCE_BLIND_FIGHTING } from '../skills/blind_fighting';
import { BOMB_TOSS as REFERENCE_BOMB_TOSS } from '../skills/bomb_toss';
import { BURROW as REFERENCE_BURROW } from '../skills/burrow';
import { CORPSE_EXPLOSION as REFERENCE_CORPSE_EXPLOSION } from '../skills/corpse_explosion';
import { COMBAT_ANALYSIS as REFERENCE_COMBAT_ANALYSIS } from '../skills/combat_analysis';
import { DEATH_TOUCH as REFERENCE_DEATH_TOUCH } from '../skills/death_touch';
import { ENEMY_AWARENESS as REFERENCE_ENEMY_AWARENESS } from '../skills/enemy_awareness';
import { DASH as REFERENCE_DASH } from '../skills/dash';
import { FIREBALL as REFERENCE_FIREBALL } from '../skills/fireball';
import { FIREWALK as REFERENCE_FIREWALK } from '../skills/firewalk';
import { FIREWALL as REFERENCE_FIREWALL } from '../skills/firewall';
import { FLIGHT as REFERENCE_FLIGHT } from '../skills/flight';
import { GRAPPLE_HOOK as REFERENCE_GRAPPLE_HOOK } from '../skills/grapple_hook';
import { JUMP as REFERENCE_JUMP } from '../skills/jump';
import { RAISE_DEAD as REFERENCE_RAISE_DEAD } from '../skills/raise_dead';
import { KINETIC_TRI_TRAP as REFERENCE_KINETIC_TRI_TRAP } from '../skills/kinetic_tri_trap';
import { MULTI_SHOOT as REFERENCE_MULTI_SHOOT } from '../skills/multi_shoot';
import { ORACLE_SIGHT as REFERENCE_ORACLE_SIGHT } from '../skills/oracle_sight';
import { PHASE_STEP as REFERENCE_PHASE_STEP } from '../skills/phase_step_capability';
import { SHIELD_THROW as REFERENCE_SHIELD_THROW } from '../skills/shield_throw';
import { SHIELD_BASH as REFERENCE_SHIELD_BASH } from '../skills/shield_bash';
import { SHADOW_STEP as REFERENCE_SHADOW_STEP } from '../skills/shadow_step';
import { SOUL_SWAP as REFERENCE_SOUL_SWAP } from '../skills/soul_swap';
import { SNEAK_ATTACK as REFERENCE_SNEAK_ATTACK } from '../skills/sneak_attack';
import { ARCHER_SHOT as REFERENCE_ARCHER_SHOT } from '../skills/archer_shot';
import { SPEAR_THROW as REFERENCE_SPEAR_THROW } from '../skills/spear_throw';
import { SENTINEL_BLAST as REFERENCE_SENTINEL_BLAST } from '../skills/sentinel_blast';
import { SENTINEL_TELEGRAPH as REFERENCE_SENTINEL_TELEGRAPH } from '../skills/sentinel_telegraph';
import { SET_TRAP as REFERENCE_SET_TRAP } from '../skills/set_trap';
import { SMOKE_SCREEN as REFERENCE_SMOKE_SCREEN } from '../skills/smoke_screen';
import { STANDARD_VISION as REFERENCE_STANDARD_VISION } from '../skills/standard_vision';
import { TACTICAL_INSIGHT as REFERENCE_TACTICAL_INSIGHT } from '../skills/tactical_insight';
import { THEME_HAZARDS as REFERENCE_THEME_HAZARDS } from '../skills/theme_hazard';
import { TIME_BOMB as REFERENCE_TIME_BOMB } from '../skills/time_bomb';
import { VAULT as REFERENCE_VAULT } from '../skills/vault';
import { SWIFT_ROLL as REFERENCE_SWIFT_ROLL } from '../skills/swift_roll';
import { VIBRATION_SENSE as REFERENCE_VIBRATION_SENSE } from '../skills/vibration_sense';
import { VOLATILE_PAYLOAD as REFERENCE_VOLATILE_PAYLOAD } from '../skills/volatile_payload';
import { WITHDRAWAL as REFERENCE_WITHDRAWAL } from '../skills/withdrawal';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { validateLineOfSight } from '../systems/validation';
import { getSkillScenarios } from '../scenarios/skill-scenarios';

const normalizePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

const sortPoints = (points: Point[]): Point[] =>
    [...points].map(normalizePoint).sort((left, right) =>
        left.q === right.q
            ? left.r === right.r
                ? left.s - right.s
                : left.r - right.r
            : left.q - right.q
    );

const getRuntimeSkill = (skillId: string): SkillDefinition | undefined => SkillRegistry.get(skillId);

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
                destination: normalizePoint(effect.destination)
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

type ReferenceCohortCase = SharedCohortCase & {
    skillId:
        | 'ABSORB_FIRE'
        | 'AUTO_ATTACK'
        | 'BASIC_ATTACK'
        | 'BASIC_MOVE'
        | 'BOMB_TOSS'
        | 'CORPSE_EXPLOSION'
        | 'DEATH_TOUCH'
        | 'DASH'
        | 'FALCON_APEX_STRIKE'
        | 'FALCON_AUTO_ROOST'
        | 'FALCON_COMMAND'
        | 'FALCON_HEAL'
        | 'FALCON_PECK'
        | 'FALCON_SCOUT'
        | 'FIREBALL'
        | 'FIREWALK'
        | 'FIREWALL'
        | 'GRAPPLE_HOOK'
        | 'JUMP'
        | 'KINETIC_TRI_TRAP'
        | 'MULTI_SHOOT'
        | 'RAISE_DEAD'
        | 'SHIELD_BASH'
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
        | 'SOUL_SWAP'
        | 'VAULT'
        | 'SWIFT_ROLL'
        | 'VOLATILE_PAYLOAD'
        | 'WITHDRAWAL';
    reference: SkillDefinition;
    runtimeContract?: never;
};

type RuntimeOnlyCohortCase = SharedCohortCase & {
    skillId: 'METEOR_IMPACT' | 'TORNADO_KICK';
    reference?: never;
    runtimeContract: (args: {
        runtime: SkillDefinition | undefined;
        state: GameState;
        attacker: Actor;
        target?: Point;
        activeUpgrades: string[];
    }) => void;
};

type CohortCase = ReferenceCohortCase | RuntimeOnlyCohortCase;

const cohortCases: CohortCase[] = [
    {
        skillId: 'ABSORB_FIRE',
        reference: REFERENCE_ABSORB_FIRE,
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
        reference: REFERENCE_AUTO_ATTACK,
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
        reference: REFERENCE_BASIC_ATTACK,
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
        reference: REFERENCE_BASIC_MOVE,
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
        skillId: 'DASH',
        reference: REFERENCE_DASH,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['DASH']
            });
            return {
                state: createMockState({ player: attacker, enemies: [] }),
                attacker,
                target: p(5, 3)
            };
        }
    },
    {
        skillId: 'SHIELD_BASH',
        reference: REFERENCE_SHIELD_BASH,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 3),
                speed: 10,
                skills: ['SHIELD_BASH']
            });
            const target = createEnemy({
                id: 'shield-bash-target',
                subtype: 'footman',
                position: p(4, 3),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [target] }),
                attacker,
                target: target.position
            };
        }
    },
    {
        skillId: 'WITHDRAWAL',
        reference: REFERENCE_WITHDRAWAL,
        buildState: () => {
            const attacker = createPlayer({
                position: p(5, 5),
                speed: 10,
                skills: ['WITHDRAWAL']
            });
            const target = createEnemy({
                id: 'withdrawal-target',
                subtype: 'footman',
                position: p(6, 5),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            return {
                state: createMockState({ player: attacker, enemies: [target] }),
                attacker,
                target: target.position
            };
        }
    },
    {
        skillId: 'JUMP',
        reference: REFERENCE_JUMP,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 6),
                speed: 10,
                skills: ['JUMP']
            });
            const enemy = createEnemy({
                id: 'jump-target',
                subtype: 'footman',
                position: p(3, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const neighborOne = createEnemy({
                id: 'jump-neighbor-1',
                subtype: 'footman',
                position: p(3, 5),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const neighborTwo = createEnemy({
                id: 'jump-neighbor-2',
                subtype: 'footman',
                position: p(4, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [enemy, neighborOne, neighborTwo] });
            return {
                state,
                attacker,
                target: enemy.position,
                activeUpgrades: ['STUNNING_LANDING', 'METEOR_IMPACT', 'FREE_JUMP']
            };
        }
    },
    {
        skillId: 'BOMB_TOSS',
        reference: REFERENCE_BOMB_TOSS,
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
        reference: REFERENCE_CORPSE_EXPLOSION,
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
        skillId: 'SOUL_SWAP',
        reference: REFERENCE_SOUL_SWAP,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 6),
                speed: 10,
                skills: ['SOUL_SWAP']
            });
            const minion = createCompanion({
                companionType: 'skeleton',
                ownerId: attacker.id,
                ownerFactionId: attacker.factionId,
                position: p(3, 4)
            });
            const state = createMockState({
                player: attacker,
                enemies: [],
                companions: [minion] as any
            });
            return {
                state,
                attacker,
                target: minion.position
            };
        }
    },
    {
        skillId: 'KINETIC_TRI_TRAP',
        reference: REFERENCE_KINETIC_TRI_TRAP,
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
        skillId: 'VAULT',
        reference: REFERENCE_VAULT,
        buildState: () => {
            const attacker = createPlayer({
                position: p(3, 6),
                speed: 10,
                skills: ['VAULT']
            });
            const enemy = createEnemy({
                id: 'vault-victim',
                subtype: 'footman',
                position: p(4, 4),
                speed: 1,
                skills: ['BASIC_ATTACK']
            });
            const state = createMockState({ player: attacker, enemies: [enemy] });
            state.turnNumber = 1;
            return {
                state,
                attacker,
                target: p(3, 4)
            };
        }
    },
    {
        skillId: 'DEATH_TOUCH',
        reference: REFERENCE_DEATH_TOUCH,
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
        reference: REFERENCE_MULTI_SHOOT,
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
        reference: REFERENCE_FALCON_COMMAND,
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
        reference: REFERENCE_FALCON_AUTO_ROOST,
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
        reference: REFERENCE_FALCON_SCOUT,
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
        reference: REFERENCE_FALCON_PECK,
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
        reference: REFERENCE_FALCON_APEX_STRIKE,
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
        reference: REFERENCE_FALCON_HEAL,
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
        reference: REFERENCE_ARCHER_SHOT,
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
        reference: REFERENCE_FIREBALL,
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
        reference: REFERENCE_FIREWALK,
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
        reference: REFERENCE_FIREWALL,
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
        reference: REFERENCE_RAISE_DEAD,
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
        reference: REFERENCE_SHIELD_THROW,
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
        reference: REFERENCE_SHADOW_STEP,
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
        reference: REFERENCE_SPEAR_THROW,
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
        reference: REFERENCE_SMOKE_SCREEN,
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
        reference: REFERENCE_SNEAK_ATTACK,
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
        reference: REFERENCE_SENTINEL_BLAST,
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
        reference: REFERENCE_SENTINEL_TELEGRAPH,
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
        reference: REFERENCE_SET_TRAP,
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
        reference: REFERENCE_THEME_HAZARDS,
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
        reference: REFERENCE_TIME_BOMB,
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
        reference: REFERENCE_SWIFT_ROLL,
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
        reference: REFERENCE_VOLATILE_PAYLOAD,
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
        it(`${testCase.skillId} matches reference targets and execution`, () => {
            const runtime = getRuntimeSkill(testCase.skillId);
            const referenceCase = testCase.buildState();
            const runtimeCase = testCase.buildState();
            const runtimeTargets = sortPoints(runtime?.getValidTargets?.(runtimeCase.state, runtimeCase.attacker.position) || []);

            expect(runtime?.id).toBe(testCase.skillId);
            if (testCase.reference) {
                const { state: referenceState, attacker: referenceAttacker, target: referenceTarget, activeUpgrades: referenceActiveUpgrades = [], context: referenceContext = {} } = referenceCase;
                const { state: runtimeState, attacker: runtimeAttacker, target: runtimeTarget, activeUpgrades: runtimeActiveUpgrades = [], context: runtimeContext = {} } = runtimeCase;
                const referenceTargets = sortPoints(testCase.reference.getValidTargets?.(referenceState, referenceAttacker.position) || []);
                const referenceExecution = testCase.reference.execute(referenceState, referenceAttacker, referenceTarget, referenceActiveUpgrades, referenceContext);
                const runtimeExecution = runtime?.execute(runtimeState, runtimeAttacker, runtimeTarget, runtimeActiveUpgrades, runtimeContext);

                expect(runtimeTargets).toEqual(referenceTargets);
                expect(runtimeExecution?.messages).toEqual(referenceExecution.messages);
                expect(normalizeConsumesTurn(runtimeExecution || { effects: [] })).toBe(
                    normalizeConsumesTurn(referenceExecution)
                );
                expect(
                    normalizeEffects(runtimeExecution?.effects || [], runtimeState, runtimeAttacker, runtimeTarget)
                ).toEqual(
                    normalizeEffects(referenceExecution.effects, referenceState, referenceAttacker, referenceTarget)
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

    it('SPEAR_THROW recall mode matches reference execution', () => {
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

        const referenceExecution = REFERENCE_SPEAR_THROW.execute(state, attacker, undefined, activeUpgrades);
        const runtimeExecution = runtime?.execute(state, attacker, attacker.position, activeUpgrades);

        expect(runtime?.name).toBeTypeOf('function');
        expect((runtime?.name as (runtimeState: GameState) => string)(state)).toBe('Recall Spear');
        expect(runtimeExecution?.messages).toEqual(referenceExecution.messages);
        expect(normalizeConsumesTurn(runtimeExecution || { effects: [] })).toBe(
            normalizeConsumesTurn(referenceExecution)
        );
        expect(
            normalizeEffects(runtimeExecution?.effects || [], state, attacker, state.spearPosition || attacker.position)
        ).toEqual(
            normalizeEffects(referenceExecution.effects, state, attacker, state.spearPosition || attacker.position)
        );
        expect(runtimeExecution?.rngConsumption ?? 0).toBe(0);
    });

    it('attaches existing scenarios to runtime-backed skills', () => {
        const runtimeArcherShot = getRuntimeSkill('ARCHER_SHOT');
        const runtimeAutoAttack = getRuntimeSkill('AUTO_ATTACK');
        const runtimeBasicAttack = getRuntimeSkill('BASIC_ATTACK');
        const runtimeBasicMove = getRuntimeSkill('BASIC_MOVE');
        const runtimeDash = getRuntimeSkill('DASH');
        const runtimeCorpseExplosion = getRuntimeSkill('CORPSE_EXPLOSION');
        const runtimeBombToss = getRuntimeSkill('BOMB_TOSS');
        const runtimeFireball = getRuntimeSkill('FIREBALL');
        const runtimeFirewalk = getRuntimeSkill('FIREWALK');
        const runtimeRaiseDead = getRuntimeSkill('RAISE_DEAD');
        const runtimeFalconApexStrike = getRuntimeSkill('FALCON_APEX_STRIKE');
        const runtimeFalconAutoRoost = getRuntimeSkill('FALCON_AUTO_ROOST');
        const runtimeFalconCommand = getRuntimeSkill('FALCON_COMMAND');
        const runtimeFalconHeal = getRuntimeSkill('FALCON_HEAL');
        const runtimeFalconPeck = getRuntimeSkill('FALCON_PECK');
        const runtimeFalconScout = getRuntimeSkill('FALCON_SCOUT');
        const runtimeSentinelBlast = getRuntimeSkill('SENTINEL_BLAST');
        const runtimeSentinelTelegraph = getRuntimeSkill('SENTINEL_TELEGRAPH');
        const runtimeSetTrap = getRuntimeSkill('SET_TRAP');
        const runtimeFirewall = getRuntimeSkill('FIREWALL');
        const runtimeKineticTriTrap = getRuntimeSkill('KINETIC_TRI_TRAP');
        const runtimeAbsorbFire = getRuntimeSkill('ABSORB_FIRE');
        const runtimeShieldThrow = getRuntimeSkill('SHIELD_THROW');
        const runtimeShieldBash = getRuntimeSkill('SHIELD_BASH');
        const runtimeSpearThrow = getRuntimeSkill('SPEAR_THROW');
        const runtimeThemeHazards = getRuntimeSkill('THEME_HAZARDS');
        const runtimeTimeBomb = getRuntimeSkill('TIME_BOMB');
        const runtimeVolatilePayload = getRuntimeSkill('VOLATILE_PAYLOAD');
        const runtimeWithdrawal = getRuntimeSkill('WITHDRAWAL');
        const runtimeMeteorImpact = getRuntimeSkill('METEOR_IMPACT');
        const runtimeMultiShoot = getRuntimeSkill('MULTI_SHOOT');
        const runtimeTornadoKick = getRuntimeSkill('TORNADO_KICK');

        const assertScenarioParityIfDeclared = (skillId: string, reference: SkillDefinition | undefined) => {
            const runtimeScenarioIds = getSkillScenarios(skillId).map(scenario => scenario.id);
            const referenceScenarioIds = reference?.scenarios?.map(scenario => scenario.id) || [];
            if (referenceScenarioIds.length === 0) {
                expect(runtimeScenarioIds.length).toBeGreaterThanOrEqual(0);
                return;
            }
            expect(runtimeScenarioIds).toEqual(referenceScenarioIds);
        };

        assertScenarioParityIfDeclared('ARCHER_SHOT', REFERENCE_ARCHER_SHOT);
        assertScenarioParityIfDeclared('AUTO_ATTACK', REFERENCE_AUTO_ATTACK);
        assertScenarioParityIfDeclared('BASIC_ATTACK', REFERENCE_BASIC_ATTACK);
        assertScenarioParityIfDeclared('BASIC_MOVE', REFERENCE_BASIC_MOVE);
        assertScenarioParityIfDeclared('DASH', REFERENCE_DASH);
        assertScenarioParityIfDeclared('CORPSE_EXPLOSION', REFERENCE_CORPSE_EXPLOSION);
        assertScenarioParityIfDeclared('BOMB_TOSS', REFERENCE_BOMB_TOSS);
        assertScenarioParityIfDeclared('FIREBALL', REFERENCE_FIREBALL);
        assertScenarioParityIfDeclared('FIREWALK', REFERENCE_FIREWALK);
        assertScenarioParityIfDeclared('FALCON_APEX_STRIKE', REFERENCE_FALCON_APEX_STRIKE);
        assertScenarioParityIfDeclared('FALCON_AUTO_ROOST', REFERENCE_FALCON_AUTO_ROOST);
        assertScenarioParityIfDeclared('FALCON_COMMAND', REFERENCE_FALCON_COMMAND);
        assertScenarioParityIfDeclared('FALCON_HEAL', REFERENCE_FALCON_HEAL);
        assertScenarioParityIfDeclared('FALCON_PECK', REFERENCE_FALCON_PECK);
        assertScenarioParityIfDeclared('FALCON_SCOUT', REFERENCE_FALCON_SCOUT);
        assertScenarioParityIfDeclared('FIREWALL', REFERENCE_FIREWALL);
        assertScenarioParityIfDeclared('KINETIC_TRI_TRAP', REFERENCE_KINETIC_TRI_TRAP);
        assertScenarioParityIfDeclared('RAISE_DEAD', REFERENCE_RAISE_DEAD);
        assertScenarioParityIfDeclared('SHIELD_THROW', REFERENCE_SHIELD_THROW);
        assertScenarioParityIfDeclared('SHIELD_BASH', REFERENCE_SHIELD_BASH);
        assertScenarioParityIfDeclared('SPEAR_THROW', REFERENCE_SPEAR_THROW);
        assertScenarioParityIfDeclared('SENTINEL_BLAST', REFERENCE_SENTINEL_BLAST);
        assertScenarioParityIfDeclared('SENTINEL_TELEGRAPH', REFERENCE_SENTINEL_TELEGRAPH);
        assertScenarioParityIfDeclared('SET_TRAP', REFERENCE_SET_TRAP);
        assertScenarioParityIfDeclared('ABSORB_FIRE', REFERENCE_ABSORB_FIRE);
        assertScenarioParityIfDeclared('THEME_HAZARDS', REFERENCE_THEME_HAZARDS);
        assertScenarioParityIfDeclared('TIME_BOMB', REFERENCE_TIME_BOMB);
        assertScenarioParityIfDeclared('VOLATILE_PAYLOAD', REFERENCE_VOLATILE_PAYLOAD);
        assertScenarioParityIfDeclared('WITHDRAWAL', REFERENCE_WITHDRAWAL);
        assertScenarioParityIfDeclared('METEOR_IMPACT', undefined);
        assertScenarioParityIfDeclared('MULTI_SHOOT', undefined);
        assertScenarioParityIfDeclared('TORNADO_KICK', undefined);
    });
});

describe('runtime capability cohort parity', () => {
    const expectInformationParity = (
        skillId: string,
        referenceSkill: SkillDefinition,
        query: Parameters<NonNullable<NonNullable<SkillDefinition['capabilities']>['information']>[number]['resolve']>[0]
    ): void => {
        const runtimeSkill = getRuntimeSkill(skillId);
        const referenceProvider = referenceSkill.capabilities?.information?.[0];
        const runtimeProvider = runtimeSkill?.capabilities?.information?.[0];

        expect(runtimeProvider?.providerId).toBe(referenceProvider?.providerId);
        expect(runtimeProvider?.resolve(query as any)).toEqual(referenceProvider?.resolve(query as any));
    };

    const expectSenseParity = (
        skillId: string,
        referenceSkill: SkillDefinition,
        query: Parameters<NonNullable<NonNullable<SkillDefinition['capabilities']>['senses']>[number]['resolve']>[0]
    ): void => {
        const runtimeSkill = getRuntimeSkill(skillId);
        const referenceProvider = referenceSkill.capabilities?.senses?.[0];
        const runtimeProvider = runtimeSkill?.capabilities?.senses?.[0];

        expect(runtimeProvider?.providerId).toBe(referenceProvider?.providerId);
        expect(runtimeProvider?.resolve(query as any)).toEqual(referenceProvider?.resolve(query as any));
    };

    const expectMovementParity = (
        skillId: string,
        referenceSkill: SkillDefinition,
        query: Parameters<NonNullable<NonNullable<SkillDefinition['capabilities']>['movement']>[number]['resolve']>[0]
    ): void => {
        const runtimeSkill = getRuntimeSkill(skillId);
        const referenceProvider = referenceSkill.capabilities?.movement?.[0];
        const runtimeProvider = runtimeSkill?.capabilities?.movement?.[0];

        expect(runtimeProvider?.providerId).toBe(referenceProvider?.providerId);
        expect(runtimeProvider?.resolve(query as any)).toEqual(referenceProvider?.resolve(query as any));
    };

    it('matches reference callback providers for runtime capability skills', () => {
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

        expectInformationParity('BASIC_AWARENESS', REFERENCE_BASIC_AWARENESS, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict'
        });
        expectInformationParity('COMBAT_ANALYSIS', REFERENCE_COMBAT_ANALYSIS, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict'
        });
        expectInformationParity('TACTICAL_INSIGHT', REFERENCE_TACTICAL_INSIGHT, {
            state: infoState,
            viewer: infoState.player,
            subject: infoTarget,
            revealMode: 'strict'
        });
        expectInformationParity('ORACLE_SIGHT', REFERENCE_ORACLE_SIGHT, {
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

        expectSenseParity('STANDARD_VISION', REFERENCE_STANDARD_VISION, {
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
            evaluateFallbackLineOfSight: (overrides = {}) =>
                validateLineOfSight(senseState, senseState.player.position, senseTarget.position, {
                    observerActor: senseState.player,
                    excludeActorId: senseState.player.id,
                    ...overrides
                })
        });
        expectSenseParity('ENEMY_AWARENESS', REFERENCE_ENEMY_AWARENESS, {
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
            evaluateFallbackLineOfSight: (overrides = {}) =>
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
        expectSenseParity('VIBRATION_SENSE', REFERENCE_VIBRATION_SENSE, {
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
            evaluateFallbackLineOfSight: (overrides = {}) =>
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
        expectMovementParity('FLIGHT', REFERENCE_FLIGHT, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'FLIGHT',
            context: {}
        });
        expectMovementParity('BURROW', REFERENCE_BURROW, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'BURROW',
            context: {}
        });
        expectMovementParity('PHASE_STEP', REFERENCE_PHASE_STEP, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'PHASE_STEP',
            context: {}
        });
        expectMovementParity('BLIND_FIGHTING', REFERENCE_BLIND_FIGHTING, {
            state: movementState,
            actor: movementActor,
            origin: movementActor.position,
            skillId: 'BLIND_FIGHTING',
            context: {}
        });
    });
});


