import { listEnemyCatalogEntries, getEnemyCatalogSkillLoadout } from '../../data/enemies';
import type { SkillPowerProfile, EnemyPowerProfile } from './balance-schema';
import { computeSkillPowerProfileMap } from './balance-skill-power';
import { computeUnitPowerProfile } from './balance-unit-power';

const round2 = (value: number): number => Number(value.toFixed(2));

export const computeEnemyPowerProfile = (
    subtype: string,
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap()
): EnemyPowerProfile => {
    const entry = listEnemyCatalogEntries().find(candidate => candidate.subtype === subtype);
    if (!entry) {
        throw new Error(`Unknown enemy subtype "${subtype}"`);
    }

    const runtimeSkillIds = getEnemyCatalogSkillLoadout(subtype, { source: 'runtime', includePassive: true });
    const unitProfile = computeUnitPowerProfile({
        unitId: subtype,
        unitKind: 'enemy',
        skillIds: runtimeSkillIds,
        trinity: entry.bestiary.trinity,
        hp: entry.bestiary.stats.hp,
        maxHp: entry.bestiary.stats.maxHp,
        speed: entry.bestiary.stats.speed,
        weightClass: entry.bestiary.stats.weightClass,
        baseDamage: entry.bestiary.stats.damage,
        baseRange: entry.bestiary.stats.range,
        actionCooldown: entry.bestiary.stats.actionCooldown
    }, skillProfilesById);

    const hazardSkillCount = runtimeSkillIds.reduce((count, skillId) => {
        const profile = skillProfilesById[skillId];
        return count + (profile?.intentTags.includes('hazard') ? 1 : 0);
    }, 0);
    const spawnedHazardPressureScore = round2(
        (entry.contract.spawnedHazardProfile?.budgetContribution || 0) * 3
        + (entry.contract.spawnedHazardProfile?.radius || 0) * 2
        + (entry.contract.spawnedHazardProfile?.delayTurns === 2 ? 1 : 0)
    );
    const threatProjectionScore = round2(
        (entry.bestiary.stats.range * 1.6)
        + (unitProfile.offenseScore * 0.38)
        + (unitProfile.actionEconomyScore * 0.28)
    );
    const spikePressureScore = round2(
        (entry.bestiary.stats.damage * 3)
        + (unitProfile.offenseScore * 0.22)
        + (entry.bestiary.stats.type === 'boss' ? 4 : 0)
    );
    const zoneDenialScore = round2(
        (unitProfile.controlScore * 0.8)
        + (hazardSkillCount * 1.4)
        + spawnedHazardPressureScore
        + (entry.bestiary.stats.type === 'ranged' ? 0.6 : 0)
    );
    const reliabilityScore = round2(
        Math.max(0.5, 4 - entry.bestiary.stats.actionCooldown)
        + (runtimeSkillIds.length * 0.35)
        + entry.bestiary.stats.speed
    );
    const intrinsicPowerScore = round2(
        (unitProfile.intrinsicPowerScore * 0.58)
        + (threatProjectionScore * 0.45)
        + (spikePressureScore * 0.42)
        + (zoneDenialScore * 0.35)
        + (reliabilityScore * 0.28)
        + (entry.bestiary.stats.cost * 0.75)
    );

    return {
        ...unitProfile,
        unitKind: 'enemy',
        subtype,
        enemyType: entry.bestiary.stats.type,
        budgetCost: entry.bestiary.stats.cost,
        combatRole: entry.contract.combatRole,
        balanceTags: [...entry.contract.balanceTags],
        armorBurdenTier: entry.contract.metabolicProfile.armorBurdenTier,
        threatProjectionScore,
        spikePressureScore,
        zoneDenialScore,
        reliabilityScore,
        spawnedHazardPressureScore,
        intrinsicPowerScore
    };
};

export const computeAllEnemyPowerProfiles = (
    skillProfilesById: Record<string, SkillPowerProfile> = computeSkillPowerProfileMap()
): EnemyPowerProfile[] =>
    listEnemyCatalogEntries()
        .map(entry => computeEnemyPowerProfile(entry.subtype, skillProfilesById))
        .sort((left, right) =>
            right.intrinsicPowerScore - left.intrinsicPowerScore
            || left.subtype.localeCompare(right.subtype)
        );
