import { describe, expect, it } from 'vitest';
import { SkillRegistry } from '../skillRegistry';
import { getRuntimeSkillLibraryMetadata, SkillRuntimeRegistry } from '../systems/skill-runtime';
import { RUNTIME_SKILL_COVERAGE, RUNTIME_SKILL_COVERAGE_BY_ID } from './runtime_skill_coverage';

const ALLOWED_TAGS = new Set([
    'parity-covered',
    'scenario-covered',
    'vm-covered',
    'cross-system-covered'
]);

describe('runtime skill coverage manifest', () => {
    it('covers every runtime-authored skill in metadata', () => {
        const metadata = getRuntimeSkillLibraryMetadata();
        const runtimeIds = [...metadata.skills.map(skill => skill.id)].sort();
        const manifestIds = [...RUNTIME_SKILL_COVERAGE_BY_ID.keys()].sort();

        expect(metadata.totalSkills).toBe(runtimeIds.length);
        expect(metadata.handlerRatio).toBe(0);
        expect(manifestIds).toEqual(runtimeIds);
        expect(RUNTIME_SKILL_COVERAGE_BY_ID.size).toBe(runtimeIds.length);

        for (const entry of RUNTIME_SKILL_COVERAGE) {
            expect(entry.tags.length).toBeGreaterThan(0);
            expect(entry.tags.every(tag => ALLOWED_TAGS.has(tag))).toBe(true);

            const runtime = SkillRuntimeRegistry.get(entry.skillId);
            expect(runtime?.id).toBe(entry.skillId);
            expect(runtime?.compiledFrom).toBe('json');

            const scenarios = SkillRegistry.get(entry.skillId)?.scenarios?.map(scenario => scenario.id) || [];
            if (entry.tags.includes('scenario-covered')) {
                expect(scenarios.length).toBeGreaterThan(0);
            }

            if (entry.tags.includes('vm-covered') && !entry.tags.includes('scenario-covered')) {
                expect(scenarios).toEqual([]);
            }
        }
    });
});
