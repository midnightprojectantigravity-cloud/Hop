import { TRINITY_PROFILE_SET_VERSION, getTrinityProfile } from '../combat/trinity-profiles';
import type { TrinityStats } from '../combat/trinity-resolver';
import { DEFAULT_LOADOUTS } from '../loadout';
import type { WeightClass } from '../../types';
import type { SkillPowerProfile, UnitPowerProfile } from './balance-schema';
import { computeSkillPowerProfileMap } from './balance-skill-power';

const round2 = (value: number): number => Number(value.toFixed(2));

const weightBonus = (weightClass?: WeightClass): number => {
    switch (weightClass) {
        case 'Light':
            return -0.5;
        case 'Heavy':
            return 1.5;
        case 'Anchored':
        case 'OuterWall':
            return 2.5;
        default:
            return 0;
    }
};

const resolveBand = (score: number): UnitPowerProfile['powerBand'] => {
    if (score < 10) return 'trivial';
    if (score < 18) return 'low';
    if (score < 28) return 'medium';
    if (score < 40) return 'high';
    return 'spike';
};

export interface UnitPowerInput {
    unitId: string;
    unitKind: UnitPowerProfile['unitKind'];
    skillIds: string[];
    trinity: TrinityStats;
    hp: number;
    maxHp: number;
    speed: number;
    weightClass?: WeightClass;
    baseDamage?: number;
    baseRange?: number;
    actionCooldown?: number;
}

export const computeUnitPowerProfile = (
    input: UnitPowerInput,
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap()
): UnitPowerProfile => {
    const skillProfiles = input.skillIds
        .map(skillId => skillProfilesById[skillId])
        .filter((profile): profile is SkillPowerProfile => Boolean(profile));

    const baseDamage = Math.max(0, input.baseDamage || 0);
    const baseRange = Math.max(0, input.baseRange || 0);
    const cooldownFactor = input.actionCooldown !== undefined
        ? Math.max(0.5, 4 - input.actionCooldown)
        : 1;

    const chassisDurabilityScore = round2(
        (Math.max(1, input.maxHp) * 1.8)
        + (input.trinity.body * 1.25)
        + (weightBonus(input.weightClass) * 1.5)
    );
    const actionEconomyScore = round2(
        (input.speed * 3)
        + (input.trinity.instinct * 0.65)
        + (cooldownFactor * 1.4)
    );
    const offenseScore = round2(
        (baseDamage * 3)
        + (baseRange * 0.45)
        + skillProfiles.reduce((sum, profile) =>
            sum + (profile.directDamageScore * 0.55) + (profile.areaCoverageScore * 0.25),
        0)
    );
    const controlScore = round2(skillProfiles.reduce((sum, profile) =>
        sum + (profile.controlScore * 0.8) + (profile.hazardSynergyScore * 0.2),
    0));
    const mobilityScore = round2(
        skillProfiles.reduce((sum, profile) => sum + profile.mobilityScore, 0)
        + (input.speed * 0.6)
        - Math.max(0, weightBonus(input.weightClass))
    );
    const sustainScore = round2(
        skillProfiles.reduce((sum, profile) => sum + profile.defenseScore, 0)
        + (input.trinity.body * 0.45)
        + (input.trinity.mind * 0.35)
    );
    const intrinsicPowerScore = round2(Math.max(
        0,
        (chassisDurabilityScore * 0.42)
        + (actionEconomyScore * 0.4)
        + (offenseScore * 0.46)
        + (controlScore * 0.3)
        + (mobilityScore * 0.22)
        + (sustainScore * 0.3)
    ));

    return {
        unitId: input.unitId,
        unitKind: input.unitKind,
        skillIds: [...input.skillIds],
        trinity: input.trinity,
        hp: input.hp,
        maxHp: input.maxHp,
        speed: input.speed,
        weightClass: input.weightClass,
        chassisDurabilityScore,
        actionEconomyScore,
        offenseScore,
        controlScore,
        mobilityScore,
        sustainScore,
        intrinsicPowerScore,
        powerBand: resolveBand(intrinsicPowerScore),
        rationale: [
            `durability ${chassisDurabilityScore}`,
            `economy ${actionEconomyScore}`,
            `offense ${offenseScore}`,
            `control ${controlScore}`,
            `mobility ${mobilityScore}`,
            `sustain ${sustainScore}`
        ]
    };
};

export const computeAllPlayerUnitPowerProfiles = (
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap(),
    _trinityProfileId: string = TRINITY_PROFILE_SET_VERSION
): UnitPowerProfile[] => {
    const profile = getTrinityProfile();
    return Object.values(DEFAULT_LOADOUTS)
        .map(loadout => {
            const trinity = profile.archetype[loadout.id] || profile.default;
            return computeUnitPowerProfile({
                unitId: loadout.id,
                unitKind: 'player_loadout',
                skillIds: loadout.startingSkills,
                trinity,
                hp: Math.max(1, Math.round((trinity.body * 5) + (trinity.mind * 2) + (trinity.instinct * 3))),
                maxHp: Math.max(1, Math.round((trinity.body * 5) + (trinity.mind * 2) + (trinity.instinct * 3))),
                speed: 1,
                weightClass: 'Standard'
            }, skillProfilesById);
        })
        .sort((left, right) =>
            right.intrinsicPowerScore - left.intrinsicPowerScore
            || left.unitId.localeCompare(right.unitId)
        );
};
