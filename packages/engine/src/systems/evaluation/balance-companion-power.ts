import { listCompanionBalanceEntries } from '../../data/companions/content';
import type { CompanionPowerProfile, SkillPowerProfile } from './balance-schema';
import { computeSkillPowerProfileMap } from './balance-skill-power';
import { computeUnitPowerProfile } from './balance-unit-power';

export const computeCompanionPowerProfile = (
    subtype: string,
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap()
): CompanionPowerProfile => {
    const entry = listCompanionBalanceEntries().find(candidate => candidate.subtype === subtype);
    if (!entry) {
        throw new Error(`Unknown companion subtype "${subtype}"`);
    }

    const unitProfile = computeUnitPowerProfile({
        unitId: subtype,
        unitKind: 'companion',
        skillIds: entry.skills,
        trinity: entry.trinity,
        hp: entry.hp,
        maxHp: entry.maxHp,
        speed: entry.speed,
        weightClass: entry.weightClass
    }, skillProfilesById);

    return {
        ...unitProfile,
        unitKind: 'companion',
        subtype: entry.subtype,
        companionRole: entry.role,
        powerBudgetClass: entry.powerBudgetClass,
        evaluationExcludedFromEnemyBudget: entry.evaluationExcludedFromEnemyBudget
    };
};

export const computeAllCompanionPowerProfiles = (
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap()
): CompanionPowerProfile[] =>
    listCompanionBalanceEntries()
        .map(entry => computeCompanionPowerProfile(entry.subtype, skillProfilesById))
        .sort((left, right) =>
            right.intrinsicPowerScore - left.intrinsicPowerScore
            || left.subtype.localeCompare(right.subtype)
        );
