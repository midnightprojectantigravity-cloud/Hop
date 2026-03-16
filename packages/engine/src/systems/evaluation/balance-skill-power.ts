import type { SkillDefinition } from '../../types';
import { SkillRegistry } from '../../skillRegistry';
import { COMPOSITIONAL_SKILLS } from '../../skillRegistry';
import type { BalanceBudgetBand, SkillPowerProfile } from './balance-schema';
import type { SkillResourceProfile } from '../../types';

const round2 = (value: number): number => Number(value.toFixed(2));

const resolveBand = (score: number): BalanceBudgetBand => {
    if (score < 4) return 'trivial';
    if (score < 8) return 'low';
    if (score < 14) return 'medium';
    if (score < 20) return 'high';
    return 'spike';
};

const resolvePatternAreaFactor = (
    pattern: 'self' | 'single' | 'line' | 'radius' | 'global' | undefined,
    aoeRadius: number | undefined
): number => {
    switch (pattern) {
        case 'line':
            return 1.25;
        case 'radius':
            return 1 + ((aoeRadius || 0) * 0.75);
        case 'global':
            return 1.8;
        case 'self':
            return 0.85;
        default:
            return 1;
    }
};

const computeSkillPowerProfileForDefinition = (
    def: SkillDefinition,
    resourceProfile: SkillResourceProfile
): SkillPowerProfile => {
    const intentProfile = def.intentProfile;
    if (!intentProfile) {
        throw new Error(`Skill "${def.id}" is missing a hydrated intent profile`);
    }

    const range = Math.max(0, intentProfile.target.range || 0);
    const damage = Math.max(0, intentProfile.estimates.damage || 0);
    const movement = Math.max(0, intentProfile.estimates.movement || 0);
    const healing = Math.max(0, intentProfile.estimates.healing || 0);
    const shielding = Math.max(0, intentProfile.estimates.shielding || 0);
    const control = Math.max(0, intentProfile.estimates.control || 0);
    const summon = Math.max(0, intentProfile.estimates.summon || 0);
    const aoeRadius = intentProfile.target.aoeRadius || 0;
    const isInertPassiveSkill = (
        def.slot === 'passive'
        && resourceProfile.primaryResource === 'none'
        && !resourceProfile.countsAsMovement
        && !resourceProfile.countsAsAction
    );
    const consumesTurn = intentProfile.economy.consumesTurn !== false && !isInertPassiveSkill;
    const rangeFactor = 1 + (Math.min(range, 6) * 0.08);
    const patternFactor = resolvePatternAreaFactor(intentProfile.target.pattern, aoeRadius);
    const directDamageScore = round2(damage * rangeFactor * patternFactor);
    const areaCoverageScore = round2(
        intentProfile.target.pattern === 'radius'
            ? (1 + (aoeRadius * 2.5))
            : intentProfile.target.pattern === 'line'
                ? (2 + (range * 0.15))
                : intentProfile.target.pattern === 'global'
                    ? 5
                    : 0
    );
    const mobilityScore = round2(movement * (1 + (Math.min(range, 4) * 0.12)));
    const controlScore = round2(
        (control * 2)
        + (intentProfile.intentTags.includes('control') ? 1 : 0)
        + (intentProfile.target.pattern === 'radius' ? aoeRadius : 0)
    );
    const defenseScore = round2(
        (healing * 1.8)
        + (shielding * 2.2)
        + (intentProfile.intentTags.includes('protect') ? 1.5 : 0)
    );
    const economyTaxScore = round2(
        (resourceProfile.primaryResource !== 'none' ? resourceProfile.primaryCost / 10 : 0)
        + (resourceProfile.baseStrain / 6)
        + (intentProfile.economy.cooldown * 1.1)
        + (consumesTurn ? 1 : 0)
    );
    const setupDependencyScore = round2(
        ((intentProfile.risk.hazardAffinity || 0) * 1.5)
        + ((intentProfile.risk.noProgressCastPenalty || 0) / 10)
        + (intentProfile.risk.requireEnemyContact ? 1.5 : 0)
        + (intentProfile.target.pattern === 'self'
            && directDamageScore === 0
            && defenseScore === 0
            && controlScore === 0
            && summon === 0 ? 1 : 0)
    );
    const hazardSynergyScore = round2(
        (intentProfile.intentTags.includes('hazard') ? 1.5 : 0)
        + ((intentProfile.risk.hazardAffinity || 0) * 2)
        + (intentProfile.target.pattern === 'radius' ? 0.5 : 0)
    );
    const intrinsicPowerScore = round2(Math.max(
        0,
        (directDamageScore * 0.65)
        + (areaCoverageScore * 0.45)
        + (mobilityScore * 0.7)
        + (controlScore * 0.8)
        + (defenseScore * 0.75)
        + (hazardSynergyScore * 0.35)
        - (economyTaxScore * 0.6)
        - (setupDependencyScore * 0.45)
        + (consumesTurn ? 0 : 0.5)
    ));

    const rationale: string[] = [];
    if (directDamageScore > 0) rationale.push(`damage ${directDamageScore}`);
    if (areaCoverageScore > 0) rationale.push(`coverage ${areaCoverageScore}`);
    if (mobilityScore > 0) rationale.push(`mobility ${mobilityScore}`);
    if (controlScore > 0) rationale.push(`control ${controlScore}`);
    if (defenseScore > 0) rationale.push(`defense ${defenseScore}`);
    rationale.push(`economy tax ${economyTaxScore}`);
    if (setupDependencyScore > 0) rationale.push(`setup ${setupDependencyScore}`);

    return {
        skillId: def.id,
        slot: def.slot,
        intentTags: [...intentProfile.intentTags],
        primaryResource: resourceProfile.primaryResource,
        primaryCost: resourceProfile.primaryCost,
        directDamageScore,
        areaCoverageScore,
        mobilityScore,
        controlScore,
        defenseScore,
        economyTaxScore,
        setupDependencyScore,
        hazardSynergyScore,
        intrinsicPowerScore,
        powerBand: resolveBand(intrinsicPowerScore),
        rationale
    };
};

export const computeSkillPowerProfileWithResourceProfile = (
    skillId: string,
    resourceProfile: SkillResourceProfile
): SkillPowerProfile => {
    const def = SkillRegistry.get(skillId);
    if (!def) {
        throw new Error(`Unknown skill "${skillId}"`);
    }
    if (!def.intentProfile) {
        throw new Error(`Skill "${skillId}" is missing hydrated intent/resource profiles`);
    }
    return computeSkillPowerProfileForDefinition(def, resourceProfile);
};

export const computeSkillPowerProfile = (skillId: string): SkillPowerProfile => {
    const def = SkillRegistry.get(skillId);
    if (!def) {
        throw new Error(`Unknown skill "${skillId}"`);
    }

    const resourceProfile = def.resourceProfile;
    if (!def.intentProfile || !resourceProfile) {
        throw new Error(`Skill "${skillId}" is missing hydrated intent/resource profiles`);
    }

    return computeSkillPowerProfileForDefinition(def, resourceProfile);
};

export const computeAllSkillPowerProfiles = (): SkillPowerProfile[] =>
    Object.keys(COMPOSITIONAL_SKILLS)
        .sort()
        .map(skillId => computeSkillPowerProfile(skillId))
        .sort((left, right) =>
            right.intrinsicPowerScore - left.intrinsicPowerScore
            || left.skillId.localeCompare(right.skillId)
        );

export const computeSkillPowerProfileMap = (): Record<string, SkillPowerProfile> =>
    Object.fromEntries(computeAllSkillPowerProfiles().map(profile => [profile.skillId, profile]));
