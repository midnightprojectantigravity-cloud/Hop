import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { createActiveSkill, getSkillDefinition } from '../skillRegistry';
import { previewActionOutcome } from '../systems/action-preview';
import { createEnemy } from '../systems/entities/entity-factory';
import { buildInitiativeQueue } from '../systems/initiative';
import {
    cloneIresMetabolicConfig,
    DEFAULT_IRES_RULESET,
    DEFAULT_IRES_METABOLIC_CONFIG,
    resolveIresActionPreview,
    resolveLegacyIresRulesetFromMetabolic,
    resolveRuntimeSkillResourceProfile
} from '../systems/ires';
import { SpatialSystem } from '../systems/spatial-system';
import { recomputeVisibilityFromScratch } from '../systems/visibility';
import type { GameState } from '../types';

const prepareTravelPlayerState = (seed: string) => {
    const base = generateInitialState(1, seed);
    const playerPos = createHex(4, 8);
    const nextState = {
        ...base,
        player: {
            ...base.player,
            position: playerPos,
            previousPosition: playerPos
        },
        enemies: []
    };
    const withQueue = {
        ...nextState,
        initiativeQueue: buildInitiativeQueue(nextState),
        occupancyMask: SpatialSystem.refreshOccupancyMask(nextState)
    };
    return gameReducer(recomputeVisibilityFromScratch(withQueue), { type: 'ADVANCE_TURN' });
};

describe('IRES runtime band resolution', () => {
    it('uses ruleset metabolism when deriving mapped runtime profiles', () => {
        const customMetabolism = cloneIresMetabolicConfig(DEFAULT_IRES_METABOLIC_CONFIG);
        customMetabolism.actionBands.standard.sparkCost = 31;
        const ruleset: GameState['ruleset'] = {
            ires: {
                ...DEFAULT_IRES_RULESET,
                ...resolveLegacyIresRulesetFromMetabolic(customMetabolism)
            }
        };

        const profile = resolveRuntimeSkillResourceProfile(
            'BASIC_ATTACK',
            getSkillDefinition('BASIC_ATTACK'),
            ruleset
        );

        expect(profile.profileSource).toBe('band_derived');
        expect(profile.primaryCost).toBe(33);
        expect(profile.metabolicBandId).toBe('standard');
    });

    it('derives capability passives as inert runtime profiles', () => {
        const burrow = resolveRuntimeSkillResourceProfile('BURROW', getSkillDefinition('BURROW'));
        const flight = resolveRuntimeSkillResourceProfile('FLIGHT', getSkillDefinition('FLIGHT'));
        const phaseStep = resolveRuntimeSkillResourceProfile('PHASE_STEP', getSkillDefinition('PHASE_STEP'));

        expect(burrow.profileSource).toBe('band_derived');
        expect(burrow.metabolicBandId).toBe('maintenance');
        expect(burrow.primaryResource).toBe('none');
        expect(burrow.primaryCost).toBe(0);
        expect(burrow.baseStrain).toBe(0);
        expect(burrow.countsAsMovement).toBe(false);
        expect(burrow.countsAsAction).toBe(false);

        expect(flight.primaryResource).toBe('none');
        expect(flight.primaryCost).toBe(0);
        expect(flight.baseStrain).toBe(0);
        expect(flight.countsAsMovement).toBe(false);
        expect(flight.countsAsAction).toBe(false);

        expect(phaseStep.primaryResource).toBe('none');
        expect(phaseStep.primaryCost).toBe(0);
        expect(phaseStep.baseStrain).toBe(0);
        expect(phaseStep.countsAsMovement).toBe(false);
        expect(phaseStep.countsAsAction).toBe(false);
    });

    it('derives expanded off-roster and companion runtime skills from bands', () => {
        const bulwark = resolveRuntimeSkillResourceProfile('BULWARK_CHARGE', getSkillDefinition('BULWARK_CHARGE'));
        const multiShoot = resolveRuntimeSkillResourceProfile('MULTI_SHOOT', getSkillDefinition('MULTI_SHOOT'));
        const setTrap = resolveRuntimeSkillResourceProfile('SET_TRAP', getSkillDefinition('SET_TRAP'));
        const swiftRoll = resolveRuntimeSkillResourceProfile('SWIFT_ROLL', getSkillDefinition('SWIFT_ROLL'));
        const falconPeck = resolveRuntimeSkillResourceProfile('FALCON_PECK', getSkillDefinition('FALCON_PECK'));
        const falconApexStrike = resolveRuntimeSkillResourceProfile('FALCON_APEX_STRIKE', getSkillDefinition('FALCON_APEX_STRIKE'));
        const falconHeal = resolveRuntimeSkillResourceProfile('FALCON_HEAL', getSkillDefinition('FALCON_HEAL'));
        const falconScout = resolveRuntimeSkillResourceProfile('FALCON_SCOUT', getSkillDefinition('FALCON_SCOUT'));
        const falconAutoRoost = resolveRuntimeSkillResourceProfile('FALCON_AUTO_ROOST', getSkillDefinition('FALCON_AUTO_ROOST'));
        const timeBomb = resolveRuntimeSkillResourceProfile('TIME_BOMB', getSkillDefinition('TIME_BOMB'));

        expect(bulwark.primaryCost).toBe(30);
        expect(bulwark.baseStrain).toBe(15);
        expect(bulwark.countsAsMovement).toBe(true);
        expect(bulwark.countsAsAction).toBe(true);

        expect(multiShoot.primaryCost).toBe(30);
        expect(multiShoot.baseStrain).toBe(10);
        expect(setTrap.primaryCost).toBe(30);
        expect(setTrap.baseStrain).toBe(15);

        expect(swiftRoll.primaryCost).toBe(20);
        expect(swiftRoll.baseStrain).toBe(10);
        expect(swiftRoll.countsAsMovement).toBe(true);
        expect(swiftRoll.countsAsAction).toBe(false);
        expect(swiftRoll.travelEligible).toBe(true);

        expect(falconPeck.primaryCost).toBe(30);
        expect(falconPeck.baseStrain).toBe(10);
        expect(falconApexStrike.primaryCost).toBe(30);
        expect(falconApexStrike.baseStrain).toBe(10);
        expect(falconHeal.primaryResource).toBe('mana');
        expect(falconHeal.primaryCost).toBe(5);
        expect(falconHeal.baseStrain).toBe(5);
        expect(falconScout.primaryResource).toBe('mana');
        expect(falconScout.primaryCost).toBe(5);
        expect(falconScout.baseStrain).toBe(5);
        expect(falconScout.countsAsMovement).toBe(true);
        expect(falconScout.countsAsAction).toBe(false);
        expect(falconScout.travelEligible).toBe(false);

        expect(falconAutoRoost.primaryResource).toBe('none');
        expect(falconAutoRoost.primaryCost).toBe(0);
        expect(falconAutoRoost.baseStrain).toBe(0);
        expect(timeBomb.primaryResource).toBe('none');
        expect(timeBomb.primaryCost).toBe(0);
        expect(timeBomb.baseStrain).toBe(0);
    });

    it('keeps SENTINEL_BLAST castable for the live sentinel runtime mana pool', () => {
        const sentinel = createEnemy({
            id: 'runtime-sentinel',
            subtype: 'sentinel',
            position: createHex(0, 0),
            hp: 30,
            maxHp: 30,
            speed: 1,
            skills: ['BASIC_MOVE', 'SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'],
            weightClass: 'Heavy',
            enemyType: 'boss',
            trinity: { body: 4, mind: 2, instinct: 2 }
        });
        const skillDef = getSkillDefinition('SENTINEL_BLAST');
        const profile = resolveRuntimeSkillResourceProfile('SENTINEL_BLAST', skillDef);
        const preview = resolveIresActionPreview(sentinel, 'SENTINEL_BLAST', skillDef?.resourceProfile, undefined, 'battle', skillDef);

        expect(sentinel.ires?.maxMana).toBe(16);
        expect(profile.primaryCost).toBe(10);
        expect(profile.manaCost).toBe(10);
        expect(profile.sparkWalkScalar).toBe(1);
        expect(profile.primaryCost).toBeLessThanOrEqual(sentinel.ires?.maxMana || 0);
        expect(preview.blockedReason).toBeUndefined();
    });

    it('applies travel recovery to BASIC_MOVE but not to FIREWALK special movement', () => {
        const state = prepareTravelPlayerState('ires-runtime-band-travel');
        const firewalkTarget = createHex(4, 6);
        const firewalkTile = state.tiles.get(pointToKey(firewalkTarget));
        const firewalkState = firewalkTile ? {
            ...state,
            player: {
                ...state.player,
                activeSkills: [
                    ...state.player.activeSkills,
                    createActiveSkill('FIREWALK')
                ]
            },
            tiles: new Map(state.tiles).set(pointToKey(firewalkTarget), {
                ...firewalkTile,
                baseId: 'LAVA',
                traits: new Set([...(firewalkTile.traits || []), 'LIQUID'])
            })
        } : state;
        const basicMoveTarget = getSkillDefinition('BASIC_MOVE')!.getValidTargets!(state, state.player.position)[0]!;
        const resolvedFirewalkTarget = getSkillDefinition('FIREWALK')!.getValidTargets!(firewalkState, firewalkState.player.position)[0]!;

        const basicMovePreview = previewActionOutcome(state, {
            actorId: state.player.id,
            skillId: 'BASIC_MOVE',
            target: basicMoveTarget
        });
        const firewalkPreview = previewActionOutcome(firewalkState, {
            actorId: firewalkState.player.id,
            skillId: 'FIREWALK',
            target: resolvedFirewalkTarget
        });

        expect(basicMovePreview.ok).toBe(true);
        expect(basicMovePreview.resourcePreview?.travelRecoveryApplied).toBe(true);
        expect(firewalkPreview.ok).toBe(true);
        expect(firewalkPreview.resourcePreview?.travelRecoveryApplied).toBe(false);
        expect(firewalkPreview.resourcePreview?.travelRecoverySuppressedReason).toBe('not_travel_eligible');
    });
});
