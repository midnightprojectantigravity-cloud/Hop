import type { BaseUnitDefinition } from '../contracts';
import type { TacticalDataPack } from '../contracts';
import { listEnemyCatalogEntries } from './enemy-catalog';

export interface EnemyContentConsistencyIssue {
    code:
        | 'MISSING_UNIT_FOR_SUBTYPE'
        | 'PACK_UNIT_ID_MISMATCH'
        | 'WEIGHT_CLASS_MISMATCH'
        | 'SPEED_PROPENSITY_MISMATCH'
        | 'TRINITY_PROPENSITY_MISMATCH'
        | 'BASE_SKILL_LOADOUT_MISMATCH'
        | 'PASSIVE_SKILL_LOADOUT_MISMATCH';
    subtype: string;
    message: string;
}

const asFixedPropensityValue = (unit: BaseUnitDefinition, key: string): number | undefined => {
    const propensity = unit.propensities[key];
    if (!propensity || propensity.method !== 'fixed') return undefined;
    return propensity.value;
};

const arrayEquals = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

export const validateEnemyContentConsistency = (
    pack: TacticalDataPack
): EnemyContentConsistencyIssue[] => {
    const issues: EnemyContentConsistencyIssue[] = [];
    const unitsBySubtype = new Map<string, BaseUnitDefinition>();
    for (const unit of pack.units) {
        if (unit.actorType !== 'enemy' || !unit.subtype) continue;
        unitsBySubtype.set(unit.subtype, unit);
    }

    for (const catalogEntry of listEnemyCatalogEntries()) {
        const unit = unitsBySubtype.get(catalogEntry.subtype);
        if (!unit) {
            issues.push({
                code: 'MISSING_UNIT_FOR_SUBTYPE',
                subtype: catalogEntry.subtype,
                message: `Missing enemy unit definition for subtype "${catalogEntry.subtype}"`,
            });
            continue;
        }

        if (unit.id !== catalogEntry.packUnitId) {
            issues.push({
                code: 'PACK_UNIT_ID_MISMATCH',
                subtype: catalogEntry.subtype,
                message: `Unit id "${unit.id}" does not match content packUnitId "${catalogEntry.packUnitId}"`,
            });
        }

        if (unit.weightClass !== catalogEntry.bestiary.stats.weightClass) {
            issues.push({
                code: 'WEIGHT_CLASS_MISMATCH',
                subtype: catalogEntry.subtype,
                message: `weightClass "${unit.weightClass}" does not match bestiary "${catalogEntry.bestiary.stats.weightClass}"`,
            });
        }

        const speedValue = asFixedPropensityValue(unit, 'speed');
        if (speedValue === undefined || speedValue !== catalogEntry.bestiary.stats.speed) {
            issues.push({
                code: 'SPEED_PROPENSITY_MISMATCH',
                subtype: catalogEntry.subtype,
                message: `speed propensity "${String(speedValue)}" does not match bestiary "${catalogEntry.bestiary.stats.speed}"`,
            });
        }

        const body = asFixedPropensityValue(unit, 'body');
        const mind = asFixedPropensityValue(unit, 'mind');
        const instinct = asFixedPropensityValue(unit, 'instinct');
        if (
            body === undefined
            || mind === undefined
            || instinct === undefined
            || body !== catalogEntry.bestiary.trinity.body
            || mind !== catalogEntry.bestiary.trinity.mind
            || instinct !== catalogEntry.bestiary.trinity.instinct
        ) {
            issues.push({
                code: 'TRINITY_PROPENSITY_MISMATCH',
                subtype: catalogEntry.subtype,
                message: `trinity propensities {body:${String(body)}, mind:${String(mind)}, instinct:${String(instinct)}} do not match bestiary {body:${catalogEntry.bestiary.trinity.body}, mind:${catalogEntry.bestiary.trinity.mind}, instinct:${catalogEntry.bestiary.trinity.instinct}}`,
            });
        }

        const expectedBaseSkills = catalogEntry.runtimeSkills.base;
        const expectedPassiveSkills = catalogEntry.runtimeSkills.passive;

        if (!arrayEquals(unit.skillLoadout.baseSkillIds, expectedBaseSkills)) {
            issues.push({
                code: 'BASE_SKILL_LOADOUT_MISMATCH',
                subtype: catalogEntry.subtype,
                message: `baseSkillIds ${JSON.stringify(unit.skillLoadout.baseSkillIds)} do not match runtimeSkills.base ${JSON.stringify(expectedBaseSkills)}`,
            });
        }

        const passiveSkills = unit.skillLoadout.passiveSkillIds || [];
        if (!arrayEquals(passiveSkills, expectedPassiveSkills)) {
            issues.push({
                code: 'PASSIVE_SKILL_LOADOUT_MISMATCH',
                subtype: catalogEntry.subtype,
                message: `passiveSkillIds ${JSON.stringify(passiveSkills)} do not match runtimeSkills.passive ${JSON.stringify(expectedPassiveSkills)}`,
            });
        }
    }

    return issues;
};

export const assertEnemyContentConsistency = (pack: TacticalDataPack): void => {
    const issues = validateEnemyContentConsistency(pack);
    if (issues.length === 0) return;
    const details = issues.map(issue => `[${issue.code}] ${issue.subtype}: ${issue.message}`).join(' | ');
    throw new Error(`Enemy content consistency validation failed: ${details}`);
};

