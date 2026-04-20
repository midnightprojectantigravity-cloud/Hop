import type { SkillModifier } from '../../types';
import type { SkillRuntimeDefinition } from './types';

export const materializeSkillDefinitionUpgrades = (
    definition: SkillRuntimeDefinition
): Record<string, SkillModifier> => {
    const upgrades: Record<string, SkillModifier> = {};
    for (const [upgradeId, upgrade] of Object.entries(definition.upgrades || {})) {
        const patches: NonNullable<SkillModifier['patches']> = [];
        for (const patch of upgrade.modifyNumbers || []) {
            if (patch.path === 'baseVariables.range') patches.push({ field: 'range', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.cooldown') patches.push({ field: 'cooldown', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.damage') patches.push({ field: 'damage', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.basePower') patches.push({ field: 'basePower', op: patch.op, value: patch.value });
            if (patch.path === 'baseVariables.momentum') patches.push({ field: 'momentum', op: patch.op, value: patch.value });
        }
        upgrades[upgradeId] = {
            id: upgrade.id,
            name: upgrade.name,
            description: upgrade.description,
            patches,
            extraEffects: []
        };
    }
    return upgrades;
};
