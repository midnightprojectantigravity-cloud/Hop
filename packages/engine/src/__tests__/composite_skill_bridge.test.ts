import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCompositeSkillDefinition } from '../data';
import { GENERATED_COMPOSITIONAL_SKILLS } from '../generated/skill-registry.generated';
import { clearCompositeSkillRegistry, registerCompositeSkillDefinition } from '../systems/composite-skill-bridge';
import { getRuntimeSkillLibraryMetadata } from '../systems/skill-runtime';
import { createActiveSkill, getSkillDefinition, SkillRegistry } from '../skillRegistry';

const loadCompositeSkill = () => {
    const url = new URL('../data/examples/composite-skill.shield-bash.v1.json', import.meta.url);
    return parseCompositeSkillDefinition(JSON.parse(readFileSync(url, 'utf8')));
};

describe('composite skill bridge', () => {
    afterEach(() => {
        clearCompositeSkillRegistry();
    });

    it('keeps registry-backed runtime skills available', () => {
        const definition = getSkillDefinition('BASIC_ATTACK');
        expect(definition).toBeTruthy();
        expect(createActiveSkill('BASIC_ATTACK')).toBeTruthy();
    });

    it('registers data-driven skill definitions alongside runtime-owned skills', () => {
        const def = loadCompositeSkill();
        registerCompositeSkillDefinition(def);

        const runtimeDef = getSkillDefinition(def.id);
        expect(runtimeDef).toBeTruthy();
        expect(createActiveSkill(def.id)).toBeTruthy();
        const allUpgrades = SkillRegistry.getAllUpgrades();
        expect(allUpgrades.some((u: any) => u.skillId === def.id && u.id === 'WALL_SLAM')).toBe(true);
    });

    it('keeps the residual compositional registry distinct from the live runtime library', () => {
        expect(Object.keys(GENERATED_COMPOSITIONAL_SKILLS).length).toBe(2);
        expect(getRuntimeSkillLibraryMetadata().totalSkills).toBe(51);
    });
});
