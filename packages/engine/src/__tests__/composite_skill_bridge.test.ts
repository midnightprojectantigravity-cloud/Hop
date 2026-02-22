import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCompositeSkillDefinition } from '../data';
import { clearCompositeSkillRegistry, registerCompositeSkillDefinition } from '../systems/composite-skill-bridge';
import { createActiveSkill, getSkillDefinition, SkillRegistry } from '../skillRegistry';

const loadCompositeSkill = () => {
    const url = new URL('../data/examples/composite-skill.shield-bash.v1.json', import.meta.url);
    return parseCompositeSkillDefinition(JSON.parse(readFileSync(url, 'utf8')));
};

describe('composite skill bridge', () => {
    afterEach(() => {
        clearCompositeSkillRegistry();
    });

    it('keeps legacy registry skills available', () => {
        const legacy = getSkillDefinition('BASIC_ATTACK');
        expect(legacy).toBeTruthy();
        expect(createActiveSkill('BASIC_ATTACK')).toBeTruthy();
    });

    it('registers data-driven skill definitions alongside legacy', () => {
        const def = loadCompositeSkill();
        registerCompositeSkillDefinition(def);

        const runtimeDef = getSkillDefinition(def.id);
        expect(runtimeDef).toBeTruthy();
        expect(createActiveSkill(def.id)).toBeTruthy();
        const allUpgrades = SkillRegistry.getAllUpgrades();
        expect(allUpgrades.some((u: any) => u.skillId === def.id && u.id === 'WALL_SLAM')).toBe(true);
    });
});

