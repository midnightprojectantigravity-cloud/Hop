import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    compileBaseUnitBlueprint,
    compileCompositeSkillTemplate,
    ContractValidationError,
    parseBaseUnitDefinition,
    parseCompositeSkillDefinition,
    parseTacticalDataPack
} from '../data';

const loadJson = (relativeName: string): unknown => {
    const url = new URL(`../data/examples/${relativeName}`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8'));
};

describe('data contract parser', () => {
    it('parses and compiles base unit example', () => {
        const json = loadJson('base-unit.raider.v1.json');
        const def = parseBaseUnitDefinition(json);
        const compiled = compileBaseUnitBlueprint(def);

        expect(def.id).toBe('ENEMY_RAIDER_V1');
        expect(compiled.drawOrder).toEqual(['body', 'mind', 'instinct', 'speed', 'mass']);
        expect(compiled.skillIds).toContain('DASH');
    });

    it('parses and compiles composite skill example', () => {
        const json = loadJson('composite-skill.shield-bash.v1.json');
        const def = parseCompositeSkillDefinition(json);
        const compiled = compileCompositeSkillTemplate(def);

        expect(def.id).toBe('SHIELD_BASH_V1');
        expect(compiled.baseEffects.length).toBeGreaterThan(0);
        expect(Object.keys(compiled.upgradesById)).toContain('WALL_SLAM');
    });

    it('throws structured validation errors for invalid base unit', () => {
        expect(() => parseBaseUnitDefinition({ version: '1.0.0', id: 'BAD' })).toThrowError(ContractValidationError);
    });

    it('parses tactical data pack composed from valid unit + skill definitions', () => {
        const unit = loadJson('base-unit.raider.v1.json');
        const skill = loadJson('composite-skill.shield-bash.v1.json');
        const pack = parseTacticalDataPack({
            version: '1.0.0',
            units: [unit],
            skills: [skill]
        });

        expect(pack.units).toHaveLength(1);
        expect(pack.skills).toHaveLength(1);
    });
});
