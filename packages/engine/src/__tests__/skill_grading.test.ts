import { describe, expect, it } from 'vitest';
import { computeSkillNumericGrade } from '../systems/skill-grading';
import type { SkillIntentProfile } from '../types';

const baseProfile: SkillIntentProfile = {
    id: 'BASIC_ATTACK',
    intentTags: ['damage'],
    target: { range: 1, pattern: 'single' },
    estimates: { damage: 4, movement: 0, healing: 0, shielding: 0, control: 0, summon: 0 },
    economy: { cost: 0, cooldown: 0, consumesTurn: true },
    risk: { selfExposure: 0.2, hazardAffinity: 0 },
    complexity: 1
};

describe('Skill Numeric Grading', () => {
    it('is deterministic for same profile', () => {
        const a = computeSkillNumericGrade(baseProfile);
        const b = computeSkillNumericGrade(baseProfile);
        expect(a).toEqual(b);
    });

    it('increases with higher damage all else equal', () => {
        const low = computeSkillNumericGrade(baseProfile).numericGrade;
        const high = computeSkillNumericGrade({
            ...baseProfile,
            estimates: { ...baseProfile.estimates, damage: 8 }
        }).numericGrade;
        expect(high).toBeGreaterThan(low);
    });

    it('increases with higher reach all else equal', () => {
        const short = computeSkillNumericGrade(baseProfile).numericGrade;
        const long = computeSkillNumericGrade({
            ...baseProfile,
            target: { ...baseProfile.target, range: 3 }
        }).numericGrade;
        expect(long).toBeGreaterThan(short);
    });
});

