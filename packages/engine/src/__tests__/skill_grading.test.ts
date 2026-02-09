import { describe, expect, it } from 'vitest';
import { computeDynamicSkillGrades, computeSkillNumericGrade } from '../systems/skill-grading';
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

    it('assigns mobility role preset for movement-first skills in dynamic grading', () => {
        const grades = computeDynamicSkillGrades({
            games: 10,
            winRate: 0.2,
            skillTelemetryTotals: {
                DASH: {
                    casts: 10,
                    enemyDamage: 0,
                    killShots: 0,
                    healingReceived: 0,
                    hazardDamage: 0,
                    stairsProgress: 8,
                    shrineProgress: 2,
                    floorProgress: 1
                }
            }
        });
        expect(grades.DASH.rolePreset).toBe('mobility');
        expect(typeof grades.DASH.roleAdjustedGrade).toBe('number');
    });

    it('keeps dynamic grading deterministic', () => {
        const input = {
            games: 15,
            winRate: 0.35,
            skillTelemetryTotals: {
                FIREBALL: {
                    casts: 20,
                    enemyDamage: 120,
                    killShots: 8,
                    healingReceived: 0,
                    hazardDamage: 5,
                    stairsProgress: 1,
                    shrineProgress: 0,
                    floorProgress: 0
                }
            }
        };
        const a = computeDynamicSkillGrades(input);
        const b = computeDynamicSkillGrades(input);
        expect(a).toEqual(b);
    });
});
