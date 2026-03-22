import { TRINITY_PROFILE_SET_VERSION } from '../combat/trinity-profiles';
import type { BalanceStackReport, BalanceViolationAllowlistEntry } from './balance-schema';
import { computeAllSkillPowerProfiles, computeSkillPowerProfileMap } from './balance-skill-power';
import { computeAllLoadoutPowerProfiles } from './balance-loadout-power';
import { sampleFloorDifficultyProfiles } from './balance-floor-difficulty';
import { computeAllCompanionPowerProfiles } from './balance-companion-power';
import { computeAllPlayerUnitPowerProfiles } from './balance-unit-power';
import { computeAllEnemyPowerProfiles } from './balance-enemy-power';
import { sampleEncounterDifficultyProfiles } from './balance-encounter-difficulty';
import { computeEnemyParityProfiles, computeLoadoutParityProfiles } from './balance-parity';
import { buildBalanceBudgetViolations, classifyBalanceViolations } from './balance-budget-gates';

const round2 = (value: number): number => Number(value.toFixed(2));

const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
};

export interface BuildBalanceStackReportOptions {
    runSeed?: string;
    maxFloor?: number;
    trinityProfileId?: string;
    allowlistEntries?: BalanceViolationAllowlistEntry[];
    asOfDate?: string;
}

export const buildBalanceStackReport = (
    options: BuildBalanceStackReportOptions = {}
): BalanceStackReport => {
    const runSeed = options.runSeed || 'balance-stack';
    const maxFloor = Math.max(1, options.maxFloor || 6);
    const trinityProfileId = options.trinityProfileId || TRINITY_PROFILE_SET_VERSION;
    const allowlistEntries = options.allowlistEntries || [];
    const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);
    const skillProfiles = computeAllSkillPowerProfiles();
    const skillProfilesById = computeSkillPowerProfileMap();
    const loadoutProfiles = computeAllLoadoutPowerProfiles(skillProfilesById, trinityProfileId);
    const unitProfiles = computeAllPlayerUnitPowerProfiles(skillProfilesById, trinityProfileId);
    const enemyProfiles = computeAllEnemyPowerProfiles(skillProfilesById);
    const companionProfiles = computeAllCompanionPowerProfiles(skillProfilesById);
    const floorProfiles = sampleFloorDifficultyProfiles({ runSeed, maxFloor });
    const encounterProfiles = sampleEncounterDifficultyProfiles({ runSeed, maxFloor });
    const loadoutParityProfiles = computeLoadoutParityProfiles(loadoutProfiles);
    const enemyParityProfiles = computeEnemyParityProfiles(enemyProfiles);
    const budgetViolations = buildBalanceBudgetViolations({
        enemyProfiles,
        encounterProfiles,
        loadoutParityProfiles,
        enemyParityProfiles
    });
    const classifiedViolations = classifyBalanceViolations(budgetViolations, allowlistEntries, asOfDate);
    const hottestSkill = skillProfiles[0];
    const strongestLoadout = loadoutProfiles[0];
    const strongestEnemy = enemyProfiles[0];
    const hardestFloor = [...floorProfiles].sort((left, right) =>
        right.intrinsicDifficultyScore - left.intrinsicDifficultyScore
        || left.floor - right.floor
    )[0];
    const hardestEncounter = [...encounterProfiles].sort((left, right) =>
        right.intrinsicDifficultyScore - left.intrinsicDifficultyScore
        || left.floor - right.floor
    )[0];
    const mostOverParityLoadout = loadoutParityProfiles[0];
    const mostOverParityEnemy = enemyParityProfiles[0];

    return {
        generatedAt: new Date().toISOString(),
        params: {
            runSeed,
            maxFloor,
            trinityProfileId
        },
        skillProfiles,
        loadoutProfiles,
        unitProfiles,
        enemyProfiles,
        companionProfiles,
        floorProfiles,
        encounterProfiles,
        loadoutParityProfiles,
        enemyParityProfiles,
        budgetViolations,
        allowlistedViolations: classifiedViolations.allowlistedViolations,
        unallowlistedViolations: classifiedViolations.unallowlistedViolations,
        violationSummary: {
            warnings: budgetViolations.filter(violation => violation.severity === 'warning').length,
            errors: budgetViolations.filter(violation => violation.severity === 'error').length,
            allowlistedWarnings: classifiedViolations.allowlistedViolations.filter(violation => violation.severity === 'warning').length,
            allowlistedErrors: classifiedViolations.allowlistedViolations.filter(violation => violation.severity === 'error').length
        },
        summary: {
            skillCount: skillProfiles.length,
            loadoutCount: loadoutProfiles.length,
            unitCount: unitProfiles.length,
            enemyCount: enemyProfiles.length,
            companionCount: companionProfiles.length,
            floorCount: floorProfiles.length,
            encounterCount: encounterProfiles.length,
            hottestSkillId: hottestSkill?.skillId ?? null,
            strongestLoadoutId: strongestLoadout?.loadoutId ?? null,
            strongestEnemySubtype: strongestEnemy?.subtype ?? null,
            hardestFloor: hardestFloor?.floor ?? null,
            hardestEncounterFloor: hardestEncounter?.floor ?? null,
            mostOverParityLoadoutId: mostOverParityLoadout?.loadoutId ?? null,
            mostOverParityEnemySubtype: mostOverParityEnemy?.subtype ?? null,
            loadoutMedianIntrinsicPower: round2(median(loadoutProfiles.map(profile => profile.intrinsicPowerScore)))
            ,
            enemyMedianIntrinsicPower: round2(median(enemyProfiles.map(profile => profile.intrinsicPowerScore))),
            budgetViolationCount: budgetViolations.length,
            errorBudgetViolationCount: budgetViolations.filter(violation => violation.severity === 'error').length,
            allowlistedBudgetViolationCount: classifiedViolations.allowlistedViolations.length,
            unallowlistedBudgetViolationCount: classifiedViolations.unallowlistedViolations.length
        }
    };
};
