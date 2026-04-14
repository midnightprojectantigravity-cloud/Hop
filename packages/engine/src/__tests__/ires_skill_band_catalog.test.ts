import { describe, expect, it } from 'vitest';
import { DEFAULT_IRES_METABOLIC_CONFIG } from '../systems/ires/metabolic-config';
import {
    deriveSkillResourceProfileFromBand,
    listBandMappedSkillIds,
    listExpandedBandMappedSkillIds,
    listLegacyFallbackSkillIds,
    listMappedActiveRosterSkillIds,
    resolveLegacySkillResourceProfile,
    resolveSkillMetabolicBandProfile,
    resolveRuntimeSkillResourceProfile,
    resolveSkillResourceProfile
} from '../systems/ires/skill-catalog';
import { getSkillDefinition } from '../skillRegistry';

describe('IRES skill band catalog', () => {
    it('covers all 49 known skills while preserving the 27-skill active roster subset', () => {
        expect(listBandMappedSkillIds()).toHaveLength(49);
        expect(listExpandedBandMappedSkillIds()).toHaveLength(22);
        expect(listMappedActiveRosterSkillIds()).toHaveLength(27);
        expect(listLegacyFallbackSkillIds()).toHaveLength(0);
    });

    it('resolves BASIC_MOVE from the maintenance band', () => {
        const profile = resolveSkillResourceProfile('BASIC_MOVE');

        expect(profile.profileSource).toBe('band_derived');
        expect(profile.metabolicBandId).toBe('maintenance');
        expect(profile.primaryResource).toBe('spark');
        expect(profile.primaryCost).toBe(DEFAULT_IRES_METABOLIC_CONFIG.actionBands.maintenance.sparkCost);
        expect(profile.countsAsMovement).toBe(true);
        expect(profile.countsAsAction).toBe(false);
        expect(profile.travelEligible).toBe(true);
    });

    it('applies DASH light-band offsets', () => {
        const bandProfile = resolveSkillMetabolicBandProfile('DASH');
        const profile = bandProfile ? deriveSkillResourceProfileFromBand(bandProfile) : undefined;

        expect(profile?.metabolicBandId).toBe('light');
        expect(profile?.primaryResource).toBe('spark');
        expect(profile?.primaryCost).toBe(DEFAULT_IRES_METABOLIC_CONFIG.actionBands.light.sparkCost + 2);
        expect(profile?.baseStrain).toBe(DEFAULT_IRES_METABOLIC_CONFIG.actionBands.light.baseExhaustion + 2);
    });

    it('maps SWIFT_ROLL as light spark movement with travel relief enabled', () => {
        const profile = resolveSkillResourceProfile('SWIFT_ROLL');

        expect(profile.profileSource).toBe('band_derived');
        expect(profile.metabolicBandId).toBe('light');
        expect(profile.primaryResource).toBe('spark');
        expect(profile.primaryCost).toBe(20);
        expect(profile.baseStrain).toBe(10);
        expect(profile.countsAsMovement).toBe(true);
        expect(profile.countsAsAction).toBe(false);
        expect(profile.travelEligible).toBe(true);
    });

    it('resolves FIREBALL and SENTINEL_BLAST as mana-side standard and redline bands', () => {
        const fireball = resolveSkillResourceProfile('FIREBALL');
        const sentinelBlast = resolveSkillResourceProfile('SENTINEL_BLAST');

        expect(fireball.primaryResource).toBe('mana');
        expect(fireball.metabolicBandId).toBe('standard');
        expect(sentinelBlast.primaryResource).toBe('mana');
        expect(sentinelBlast.metabolicBandId).toBe('redline');
        expect(sentinelBlast.primaryCost).toBe(DEFAULT_IRES_METABOLIC_CONFIG.actionBands.redline.manaCost - 8);
        expect(sentinelBlast.baseStrain).toBe(DEFAULT_IRES_METABOLIC_CONFIG.actionBands.redline.baseExhaustion + 2);
    });

    it('resolves DEATH_TOUCH from the same band-derived mana profile as RAISE_DEAD', () => {
        const deathTouch = resolveRuntimeSkillResourceProfile('DEATH_TOUCH', getSkillDefinition('DEATH_TOUCH'));
        const raiseDead = resolveRuntimeSkillResourceProfile('RAISE_DEAD', getSkillDefinition('RAISE_DEAD'));

        expect(deathTouch.primaryResource).toBe('mana');
        expect(deathTouch.primaryCost).toBe(raiseDead.primaryCost);
        expect(deathTouch.manaCost).toBe(raiseDead.manaCost);
        expect(deathTouch.baseStrain).toBe(raiseDead.baseStrain);
        expect(deathTouch.countsAsAction).toBe(true);
        expect(deathTouch.profileSource).toBe('band_derived');
    });

    it('resolves GRAPPLE_HOOK and FIREWALK with the expected movement semantics', () => {
        const grapple = resolveSkillResourceProfile('GRAPPLE_HOOK');
        const firewalk = resolveSkillResourceProfile('FIREWALK');

        expect(grapple.countsAsMovement).toBe(true);
        expect(grapple.countsAsAction).toBe(true);
        expect(firewalk.countsAsMovement).toBe(true);
        expect(firewalk.countsAsAction).toBe(false);
        expect(firewalk.travelEligible).toBe(false);
    });

    it('keeps capability passives inert while deriving them from the band model', () => {
        const burrow = resolveSkillResourceProfile('BURROW');
        const flight = resolveSkillResourceProfile('FLIGHT');
        const phaseStep = resolveSkillResourceProfile('PHASE_STEP');

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

    it('derives the expanded off-roster and companion action skills from their assigned bands', () => {
        const bulwark = resolveSkillResourceProfile('BULWARK_CHARGE');
        const multiShoot = resolveSkillResourceProfile('MULTI_SHOOT');
        const setTrap = resolveSkillResourceProfile('SET_TRAP');
        const falconPeck = resolveSkillResourceProfile('FALCON_PECK');
        const falconApexStrike = resolveSkillResourceProfile('FALCON_APEX_STRIKE');
        const falconHeal = resolveSkillResourceProfile('FALCON_HEAL');
        const falconScout = resolveSkillResourceProfile('FALCON_SCOUT');
        const falconAutoRoost = resolveSkillResourceProfile('FALCON_AUTO_ROOST');
        const timeBomb = resolveSkillResourceProfile('TIME_BOMB');

        expect(bulwark.primaryResource).toBe('spark');
        expect(bulwark.primaryCost).toBe(30);
        expect(bulwark.baseStrain).toBe(15);
        expect(bulwark.countsAsMovement).toBe(true);
        expect(bulwark.countsAsAction).toBe(true);

        expect(multiShoot.primaryResource).toBe('spark');
        expect(multiShoot.primaryCost).toBe(30);
        expect(multiShoot.baseStrain).toBe(10);
        expect(setTrap.primaryResource).toBe('spark');
        expect(setTrap.primaryCost).toBe(30);
        expect(setTrap.baseStrain).toBe(15);

        expect(falconPeck.primaryResource).toBe('spark');
        expect(falconPeck.primaryCost).toBe(30);
        expect(falconPeck.baseStrain).toBe(10);
        expect(falconApexStrike.primaryResource).toBe('spark');
        expect(falconApexStrike.primaryCost).toBe(30);
        expect(falconApexStrike.baseStrain).toBe(10);
        expect(falconHeal.primaryResource).toBe('mana');
        expect(falconHeal.primaryCost).toBe(5);
        expect(falconHeal.baseStrain).toBe(5);
        expect(falconHeal.countsAsAction).toBe(true);
        expect(falconScout.primaryResource).toBe('mana');
        expect(falconScout.primaryCost).toBe(5);
        expect(falconScout.baseStrain).toBe(5);
        expect(falconScout.countsAsMovement).toBe(true);
        expect(falconScout.countsAsAction).toBe(false);
        expect(falconScout.travelEligible).toBe(false);

        expect(falconAutoRoost.primaryResource).toBe('none');
        expect(falconAutoRoost.primaryCost).toBe(0);
        expect(falconAutoRoost.baseStrain).toBe(0);
        expect(falconAutoRoost.countsAsMovement).toBe(false);
        expect(falconAutoRoost.countsAsAction).toBe(false);
        expect(timeBomb.primaryResource).toBe('none');
        expect(timeBomb.primaryCost).toBe(0);
        expect(timeBomb.baseStrain).toBe(0);
        expect(timeBomb.countsAsMovement).toBe(false);
        expect(timeBomb.countsAsAction).toBe(false);
    });

    it('keeps the legacy table available for comparison even after full coverage', () => {
        const legacyBurrow = resolveLegacySkillResourceProfile('BURROW');

        expect(legacyBurrow.primaryResource).toBe('spark');
        expect(legacyBurrow.primaryCost).toBe(20);
        expect(legacyBurrow.baseStrain).toBe(10);
    });
});
