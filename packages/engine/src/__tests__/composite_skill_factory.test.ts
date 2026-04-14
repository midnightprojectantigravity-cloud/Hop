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
        const damageEffect = execution.effects.find(e => e.type === 'Damage');
        expect(damageEffect).toBeDefined();
        expect(damageEffect).toMatchObject({
            type: 'Damage',
            scoreEvent: expect.objectContaining({
                attackerId: mutatedState.player.id,
                targetId: mutatedState.enemies[0]?.id || 'targetActor',
                damageClass: 'physical',
                damageSubClass: 'strike',
                damageElement: 'neutral'
            })
        });
        expect(execution.effects.some(e => e.type === 'ApplyForce')).toBe(true);
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

    it('materializes runtime collision reactions through stack hooks', () => {
        const def = loadCompositeSkill();
        const skill = materializeCompositeSkill(def);

        const state = generateInitialState(1, 'composite-reaction-hook-seed');
        const playerPos = createHex(1, 1);
        const enemyPos = createHex(0, 1);
        const mutatedState = {
            ...state,
            player: { ...state.player, position: playerPos },
            enemies: state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e)
        };

        const execution = skill.execute(mutatedState, mutatedState.player, enemyPos, ['WALL_SLAM']);
        expect(execution.stackReactions?.afterResolve).toBeDefined();

        const collisionEffect = execution.effects.find(e => e.type === 'ApplyForce' && e.expectedCollision === true);
        expect(collisionEffect).toBeDefined();

        const reactions = execution.stackReactions?.afterResolve?.(mutatedState, collisionEffect!);

        expect(reactions?.length).toBeGreaterThan(0);
        const reactionItems = (reactions || []).map(r => ('item' in r ? r.item : r));
        expect(reactionItems.some(effect => effect.type === 'ApplyStatus')).toBe(true);
    });
});
