import { describe, expect, it } from 'vitest';
import { COMPOSITIONAL_SKILLS } from '../skillRegistry';
import { hydrateSkillIntentProfiles, validateSkillIntentProfile } from '../systems/skill-intent-profile';
import type { SkillDefinition } from '../types';

describe('Skill Intent Profiles', () => {
    it('hydrates and validates profiles for every registered skill', () => {
        const coverage = hydrateSkillIntentProfiles(COMPOSITIONAL_SKILLS as any);
        expect(coverage.missing).toEqual([]);
        expect(coverage.invalid).toEqual([]);
        const skills = Object.values(COMPOSITIONAL_SKILLS as Record<string, SkillDefinition>);
        expect(skills.length).toBeGreaterThan(0);
        for (const skill of skills) {
            expect(skill.intentProfile).toBeDefined();
            const errors = validateSkillIntentProfile(skill.intentProfile!);
            expect(errors).toEqual([]);
        }
    });
});
