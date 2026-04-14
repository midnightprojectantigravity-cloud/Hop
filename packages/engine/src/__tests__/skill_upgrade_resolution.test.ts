import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCompositeSkillDefinition, validateCompositeSkillDefinition } from '../data/contract-parser';
import { BASIC_ATTACK } from '../skills/basic_attack';
import { createMockState, p } from './test_utils';
import { applyEffects } from '../systems/effect-engine';
import { resolveSkillUpgradeSelection, resolveVirtualSkillDefinition } from '../systems/skill-upgrade-resolution';
import type { SkillDefinition } from '../types';

const makeSyntheticSkill = (): SkillDefinition => ({
    id: 'TEST_UPGRADE_ROW' as any,
    name: 'Test Upgrade Row',
    description: 'Synthetic skill row for upgrade resolution tests.',
    slot: 'offensive',
    icon: '*',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 1,
        damage: 1
    },
    combat: {
        damageClass: 'physical',
        damageSubClass: 'melee',
        damageElement: 'neutral',
        attackProfile: 'melee',
        trackingSignature: 'melee',
        weights: { body: 1 },
        leechRatio: 0
    },
    execute: () => ({ effects: [], messages: [], consumesTurn: false }),
    getValidTargets: () => [],
    upgrades: {
        TIER_ONE: {
            id: 'TIER_ONE',
            name: 'Tier One',
            description: 'First tier in the line.',
            tier: 1,
            priority: 1,
            groupId: 'path',
            compatibilityTags: ['path:test'],
            patches: [
                { field: 'damage', op: 'add', value: 1 }
            ]
        },
        TIER_TWO: {
            id: 'TIER_TWO',
            name: 'Tier Two',
            description: 'Second tier in the line.',
            tier: 2,
            priority: 1,
            groupId: 'path',
            requiredUpgrades: ['TIER_ONE'],
            incompatibleWith: ['RANGE_B'],
            compatibilityTags: ['path:test'],
            patches: [
                { field: 'damage', op: 'add', value: 2 }
            ]
        },
        RANGE_A: {
            id: 'RANGE_A',
            name: 'Range A',
            description: 'Range extender A.',
            tier: 1,
            priority: 1,
            groupId: 'range',
            compatibilityTags: ['range:test'],
            patches: [
                { field: 'range', op: 'add', value: 1 }
            ]
        },
        RANGE_B: {
            id: 'RANGE_B',
            name: 'Range B',
            description: 'Range extender B.',
            tier: 1,
            priority: 1,
            groupId: 'range',
            compatibilityTags: ['range:test'],
            patches: [
                { field: 'range', op: 'add', value: 2 }
            ]
        },
        LEECH: {
            id: 'LEECH',
            name: 'Leech',
            description: 'Adds a leech ratio using fixed-point tuning.',
            tier: 1,
            priority: 1,
            patches: [
                { field: 'leechRatio', op: 'set', scaledValue: 2_500, coefficientScale: 10_000 }
            ]
        }
    },
    scenarios: []
});

describe('skill upgrade resolution', () => {
    it('rejects a higher tier when the prerequisite tier was not requested', () => {
        const skill = makeSyntheticSkill();
        const selection = resolveSkillUpgradeSelection(skill, ['TIER_TWO']);

        expect(selection.activeUpgradeIds).toEqual([]);
        expect(selection.rejectedUpgradeIds).toEqual(['TIER_TWO']);
    });

    it('selects the winning tier and compatibility path deterministically', () => {
        const skill = makeSyntheticSkill();
        const selection = resolveSkillUpgradeSelection(skill, ['TIER_ONE', 'TIER_TWO', 'RANGE_A', 'RANGE_B', 'LEECH']);
        const resolved = resolveVirtualSkillDefinition(skill, ['TIER_ONE', 'TIER_TWO', 'RANGE_A', 'RANGE_B', 'LEECH']);

        expect(selection.activeUpgradeIds).toEqual(['TIER_TWO', 'LEECH', 'RANGE_A']);
        expect(selection.rejectedUpgradeIds).toEqual(expect.arrayContaining(['TIER_ONE', 'RANGE_B']));
        expect(resolved.activeUpgradeIds).toEqual(['TIER_TWO', 'LEECH', 'RANGE_A']);
        expect(resolved.skill.baseVariables.damage).toBe(3);
        expect(resolved.skill.baseVariables.range).toBe(2);
        expect(resolved.skill.combat?.leechRatio).toBe(0.25);
    });

    it('resolves the authored basic attack upgrade row through the same virtual-skill path', () => {
        const resolved = resolveVirtualSkillDefinition(BASIC_ATTACK, ['EXTENDED_REACH', 'POWER_STRIKE', 'VAMPIRIC'], { heldPosition: true });
        const moved = resolveVirtualSkillDefinition(BASIC_ATTACK, ['EXTENDED_REACH', 'POWER_STRIKE'], { heldPosition: false });

        expect(resolved.skill.baseVariables.damage).toBe(4);
        expect(resolved.skill.combat?.leechRatio).toBe(1);
        expect(moved.activeUpgradeIds).toEqual(['POWER_STRIKE']);
        expect(moved.rejectedUpgradeIds).toContain('EXTENDED_REACH');
        expect(moved.skill.baseVariables.damage).toBe(3);
    });

    it('rejects rogue decimal upgrade patches while accepting canonical fixed-point JSON', () => {
        const url = new URL('../data/examples/composite-skill.shield-bash.v1.json', import.meta.url);
        const valid = JSON.parse(readFileSync(url, 'utf8'));
        valid.upgrades[0].patches = [
            { field: 'leechRatio', op: 'set', scaledValue: 2_500, coefficientScale: 10_000 }
        ];
        expect(validateCompositeSkillDefinition(valid)).toEqual([]);

        const invalid = parseCompositeSkillDefinition(JSON.parse(readFileSync(url, 'utf8')));
        (invalid.upgrades[0] as any).patches = [
            { field: 'leechRatio', op: 'set', scaledValue: 2_500.5, coefficientScale: 10_000 }
        ];
        const issues = validateCompositeSkillDefinition(invalid);
        expect(issues.some(issue => issue.path === '$.upgrades[0].patches[0].scaledValue')).toBe(true);
    });
});

describe('leech recovery', () => {
    it('caps life leech by effective damage and target remaining hp', () => {
        const state = createMockState();
        state.player.hp = 1;
        state.player.maxHp = 10;
        state.enemies = [
            {
                ...state.player,
                id: 'enemy-1',
                type: 'enemy',
                factionId: 'enemy',
                position: p(5, 4),
                previousPosition: p(5, 4),
                hp: 3,
                maxHp: 3,
                activeSkills: []
            }
        ];

        const next = applyEffects(
            state,
            [{
                type: 'Damage',
                target: 'enemy-1',
                amount: 10,
                reason: 'test_leech',
                damageClass: 'physical',
                damageSubClass: 'strike',
                damageElement: 'neutral',
                leechRatio: 1
            }],
            { sourceId: state.player.id, targetId: 'enemy-1' }
        );

        expect(next.player.hp).toBe(4);
        expect(next.enemies.some(enemy => enemy.id === 'enemy-1')).toBe(false);
    });
});
