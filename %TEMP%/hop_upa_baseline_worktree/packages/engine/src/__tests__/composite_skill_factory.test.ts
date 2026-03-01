import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { parseCompositeSkillDefinition } from '../data';
import { materializeCompositeSkill } from '../systems/composite-skill-factory';

const loadCompositeSkill = () => {
    const url = new URL('../data/examples/composite-skill.shield-bash.v1.json', import.meta.url);
    return parseCompositeSkillDefinition(JSON.parse(readFileSync(url, 'utf8')));
};

describe('composite skill factory', () => {
    it('materializes schema definition into SkillDefinition shape', () => {
        const def = loadCompositeSkill();
        const skill = materializeCompositeSkill(def);

        expect(skill.id).toBe(def.id);
        expect(skill.baseVariables.range).toBe(1);
        expect(Object.keys(skill.upgrades)).toContain('WALL_SLAM');
    });

    it('converts composite effects into atomic effects at execution', () => {
        const def = loadCompositeSkill();
        const skill = materializeCompositeSkill(def);

        const state = generateInitialState(1, 'composite-skill-seed');
        const playerPos = createHex(4, 5);
        const enemyPos = createHex(5, 5);
        const mutatedState = {
            ...state,
            player: { ...state.player, position: playerPos },
            enemies: state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e)
        };

        const execution = skill.execute(mutatedState, mutatedState.player, enemyPos);
        expect(execution.effects.some(e => e.type === 'Damage')).toBe(true);
        expect(execution.effects.some(e => e.type === 'Displacement')).toBe(true);
    });

    it('applies inhibit tags by filtering matching effect tags', () => {
        const def = loadCompositeSkill();
        const skill = materializeCompositeSkill(def);

        const state = generateInitialState(1, 'composite-inhibit-seed');
        const playerPos = createHex(4, 5);
        const enemyPos = createHex(5, 5);
        const mutatedState = {
            ...state,
            player: { ...state.player, position: playerPos },
            enemies: state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e)
        };

        const execution = skill.execute(mutatedState, mutatedState.player, enemyPos, [], { inhibitTags: ['movement'] });
        expect(execution.effects.some(e => e.type === 'Displacement')).toBe(false);
        expect(execution.effects.some(e => e.type === 'Damage')).toBe(true);
    });
});

