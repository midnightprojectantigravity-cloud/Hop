import { describe, expect, it } from 'vitest';
import { assertEnemyContentConsistency, validateEnemyContentConsistency } from '../data/enemies';
import { TACTICAL_CORE_MVP_PACK } from '../data/packs/mvp-pack';

describe('enemy content consistency', () => {
    it('validates default tactical pack against canonical enemy content', () => {
        expect(() => assertEnemyContentConsistency(TACTICAL_CORE_MVP_PACK)).not.toThrow();
        expect(validateEnemyContentConsistency(TACTICAL_CORE_MVP_PACK)).toEqual([]);
    });

    it('reports runtime loadout drift between content and pack units', () => {
        const mutatedPack = {
            ...TACTICAL_CORE_MVP_PACK,
            units: TACTICAL_CORE_MVP_PACK.units.map(unit =>
                unit.subtype === 'raider'
                    ? {
                        ...unit,
                        skillLoadout: {
                            ...unit.skillLoadout,
                            baseSkillIds: [...unit.skillLoadout.baseSkillIds, 'BASIC_ATTACK']
                        }
                    }
                    : unit
            )
        };

        const issues = validateEnemyContentConsistency(mutatedPack);
        expect(issues.some(issue =>
            issue.subtype === 'raider' && issue.code === 'BASE_SKILL_LOADOUT_MISMATCH'
        )).toBe(true);
    });
});

