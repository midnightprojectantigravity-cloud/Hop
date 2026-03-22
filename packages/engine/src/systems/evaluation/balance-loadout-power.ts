import { SkillRegistry } from '../../skillRegistry';
import { TRINITY_PROFILE_SET_VERSION, getTrinityProfile } from '../combat/trinity-profiles';
import { DEFAULT_LOADOUTS } from '../loadout';
import type { LoadoutPowerProfile, SkillPowerProfile } from './balance-schema';
import { computeSkillPowerProfileMap } from './balance-skill-power';

const round2 = (value: number): number => Number(value.toFixed(2));

const resolveBand = (score: number): LoadoutPowerProfile['powerBand'] => {
    if (score < 10) return 'trivial';
    if (score < 16) return 'low';
    if (score < 24) return 'medium';
    if (score < 32) return 'high';
    return 'spike';
};

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const avg = (values: number[]): number => values.length ? sum(values) / values.length : 0;

export const computeLoadoutPowerProfile = (
    loadoutId: string,
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap(),
    _trinityProfileId: string = TRINITY_PROFILE_SET_VERSION
): LoadoutPowerProfile => {
    const loadout = DEFAULT_LOADOUTS[loadoutId];
    if (!loadout) {
        throw new Error(`Unknown loadout "${loadoutId}"`);
    }

    const trinityProfile = getTrinityProfile();
    const trinity = trinityProfile.archetype[loadoutId] || trinityProfile.default;
    const skillContexts = loadout.startingSkills
        .map(skillId => {
            const profile = skillProfilesById[skillId];
            if (!profile) return null;
            const definition = SkillRegistry.get(skillId);
            const consumesTurn = definition?.intentProfile?.economy.consumesTurn !== false;
            const actionabilityMultiplier = consumesTurn ? 1 : 0.45;
            const hazardZoneScore = profile.hazardSynergyScore + profile.controlScore + profile.areaCoverageScore;
            const isZoneControlSkill = profile.intentTags.includes('hazard') && hazardZoneScore >= 6;
            return {
                skillId,
                profile,
                consumesTurn,
                actionabilityMultiplier,
                isZoneControlSkill
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const skillProfiles = skillContexts.map(entry => entry.profile);
    const averageSetupDependency = avg(skillProfiles.map(profile => profile.setupDependencyScore));
    const reliableDamageSkillCount = skillProfiles.filter(profile =>
        profile.directDamageScore >= 4
        && profile.economyTaxScore <= 6
        && profile.setupDependencyScore <= 1.5
    ).length;
    const hazardSkillCount = skillContexts.filter(entry => entry.profile.intentTags.includes('hazard')).length;
    const zoneControlSkillCount = skillContexts.filter(entry => entry.isZoneControlSkill).length;
    const passiveConditionalDefenseScore = sum(skillContexts
        .filter(entry =>
            !entry.consumesTurn
            && entry.profile.defenseScore > 0
            && (entry.profile.intentTags.includes('heal') || entry.profile.intentTags.includes('hazard'))
        )
        .map(entry => entry.profile.defenseScore));
    const specializationPenaltyScore = round2(
        (Math.max(0, hazardSkillCount - 2) * 1.5)
        + (Math.max(0, zoneControlSkillCount - 1) * 1.75)
        + (passiveConditionalDefenseScore * 0.22)
    );
    const conversionPenaltyScore = round2(
        (!loadout.startingSkills.includes('BASIC_ATTACK') ? 1.5 : 0)
        + (reliableDamageSkillCount === 0 ? 1.5 : 0)
        + (averageSetupDependency >= 1.5 ? 0.5 : 0)
    );

    const offenseScore = round2(sum(skillProfiles.map(profile =>
        (profile.directDamageScore * 0.7) + (profile.areaCoverageScore * 0.5)
    )));
    const controlScore = round2(sum(skillProfiles.map(profile =>
        (profile.controlScore * 0.9) + (profile.hazardSynergyScore * 0.35)
    )));
    const mobilityScore = round2(sum(skillProfiles.map(profile => profile.mobilityScore)));
    const defenseScore = round2(sum(skillContexts.map(entry =>
        entry.profile.defenseScore * entry.actionabilityMultiplier
    )));
    const averageEconomyPressure = avg(skillProfiles.map(profile =>
        profile.economyTaxScore + (profile.setupDependencyScore * 0.5)
    ));
    const economyDisciplineScore = round2(Math.max(
        0,
        12 + (trinity.instinct * 0.3) + (trinity.mind * 0.15) - (averageEconomyPressure * 1.4)
    ));
    const recoveryDemandScore = round2(
        avg(skillProfiles.map(profile =>
            (profile.economyTaxScore * 0.8) + (profile.setupDependencyScore * 0.5)
        ))
        + (skillProfiles.filter(profile => profile.economyTaxScore >= 4).length * 0.75)
    );
    const hazardHandlingScore = round2(
        (controlScore * 0.3)
        + (mobilityScore * 0.25)
        + (defenseScore * 0.3)
        + (sum(skillContexts.map(entry =>
            entry.profile.intentTags.includes('hazard') ? (0.8 * entry.actionabilityMultiplier) : 0
        )))
    );
    const chassisScore = round2(
        (trinity.body * 1.2)
        + (trinity.mind * 1.1)
        + (trinity.instinct * 1.15)
    );
    const intrinsicPowerScore = round2(Math.max(
        0,
        (offenseScore * 0.45)
        + (controlScore * 0.25)
        + (mobilityScore * 0.18)
        + (defenseScore * 0.22)
        + (economyDisciplineScore * 0.35)
        + (hazardHandlingScore * 0.15)
        + (chassisScore * 0.3)
        - (recoveryDemandScore * 0.4)
        - specializationPenaltyScore
        - conversionPenaltyScore
    ));

    const rationale: string[] = [
        `chassis ${chassisScore}`,
        `offense ${offenseScore}`,
        `control ${controlScore}`,
        `mobility ${mobilityScore}`,
        `defense ${defenseScore}`,
        `economy discipline ${economyDisciplineScore}`,
        `recovery demand ${recoveryDemandScore}`
    ];
    if (specializationPenaltyScore > 0) {
        rationale.push(`specialization penalty ${specializationPenaltyScore}`);
    }
    if (conversionPenaltyScore > 0) {
        rationale.push(`conversion penalty ${conversionPenaltyScore}`);
    }

    return {
        loadoutId,
        skillIds: [...loadout.startingSkills],
        trinity,
        chassisScore,
        offenseScore,
        controlScore,
        mobilityScore,
        defenseScore,
        economyDisciplineScore,
        recoveryDemandScore,
        hazardHandlingScore,
        intrinsicPowerScore,
        powerBand: resolveBand(intrinsicPowerScore),
        rationale
    };
};

export const computeAllLoadoutPowerProfiles = (
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap(),
    trinityProfileId: string = TRINITY_PROFILE_SET_VERSION
): LoadoutPowerProfile[] =>
    Object.keys(DEFAULT_LOADOUTS)
        .sort()
        .map(loadoutId => computeLoadoutPowerProfile(loadoutId, skillProfilesById, trinityProfileId))
        .sort((left, right) =>
            right.intrinsicPowerScore - left.intrinsicPowerScore
            || left.loadoutId.localeCompare(right.loadoutId)
        );
