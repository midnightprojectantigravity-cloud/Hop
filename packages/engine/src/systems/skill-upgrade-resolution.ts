import type { SkillDefinition, SkillModifier, SkillUpgradePatchDefinition } from '../types';
import { SCALED_IDENTITY } from '../constants';

export interface SkillUpgradeResolutionContext {
    heldPosition?: boolean;
    activeUpgradeRanks?: Record<string, number>;
}

export interface SkillUpgradeSelectionResult {
    activeUpgradeIds: string[];
    rejectedUpgradeIds: string[];
}

export interface ResolvedSkillDefinitionResult {
    skill: SkillDefinition;
    activeUpgradeIds: string[];
    rejectedUpgradeIds: string[];
}

type UpgradeLike = SkillModifier;
const cloneAtomicEffect = <T>(value: T): T => (
    value && typeof value === 'object'
        ? { ...(value as Record<string, unknown>) } as T
        : value
);

const cloneSkillDefinition = (skill: SkillDefinition): SkillDefinition => ({
    ...skill,
    baseVariables: { ...skill.baseVariables },
    combat: skill.combat
        ? {
            ...skill.combat,
            weights: { ...(skill.combat.weights || {}) }
        }
        : undefined,
    upgrades: Object.fromEntries(
        Object.entries(skill.upgrades || {}).map(([id, upgrade]) => [
            id,
            {
                ...upgrade,
                requires: [...(upgrade.requires || [])],
                requiredUpgrades: [...(upgrade.requiredUpgrades || [])],
                compatibilityTags: [...(upgrade.compatibilityTags || [])],
                incompatibleWith: [...(upgrade.incompatibleWith || [])],
                patches: upgrade.patches?.map(patch => ({ ...patch })),
                extraEffects: upgrade.extraEffects?.map(cloneAtomicEffect)
            }
        ])
    )
});

const upgradeSortKey = (upgrade: UpgradeLike): [number, number, string] => [
    Number(upgrade.priority || 0),
    Number(upgrade.tier || 0),
    upgrade.id
];

const getUpgradeGroupId = (upgrade: UpgradeLike): string | undefined => upgrade.groupId || upgrade.exclusiveGroup;

const getUpgradeRequirementRanks = (upgrade: UpgradeLike): Array<{ upgradeId: string; minRank: number }> => [
    ...(upgrade.requires || []).flatMap(req => typeof req === 'string' ? [{ upgradeId: req, minRank: 1 }] : [{ upgradeId: req.upgradeId, minRank: Number.isFinite(req.minRank) ? Math.max(0, Math.floor(Number(req.minRank))) : 1 }]),
    ...(upgrade.requiredUpgrades || []).map(upgradeId => ({ upgradeId, minRank: 1 }))
];

const getUpgradeIncompatibilities = (upgrade: UpgradeLike): string[] => [
    ...(upgrade.incompatibleWith || [])
];

const countRequestedRanks = (upgradeMap: Record<string, UpgradeLike>, activeUpgradeIds: string[], context?: SkillUpgradeResolutionContext): number => (
    activeUpgradeIds.reduce((sum, upgradeId) => sum + resolveUpgradeRank(upgradeMap[upgradeId] || { id: upgradeId } as UpgradeLike, context), 0)
);

const resolveUpgradeRank = (
    upgrade: UpgradeLike,
    context?: SkillUpgradeResolutionContext
): number => {
    const runtimeRank = context?.activeUpgradeRanks?.[upgrade.id];
    const authoredRank = upgrade.currentRank;
    const rank = Number.isFinite(runtimeRank) ? Number(runtimeRank) : Number.isFinite(authoredRank) ? Number(authoredRank) : 1;
    return Math.max(0, Math.floor(rank));
};

const compareUpgrades = (left: UpgradeLike, right: UpgradeLike): number => {
    const [leftPriority, leftTier, leftId] = upgradeSortKey(left);
    const [rightPriority, rightTier, rightId] = upgradeSortKey(right);
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;
    if (leftTier !== rightTier) return rightTier - leftTier;
    return leftId.localeCompare(rightId);
};

const expandUpgradePatches = (upgrade: UpgradeLike, rank: number): SkillUpgradePatchDefinition[] => {
    const patches: SkillUpgradePatchDefinition[] = [...(upgrade.patches || [])];
    if (typeof upgrade.modifyRange === 'number' && upgrade.modifyRange !== 0) {
        patches.push({ field: 'range', op: 'add', value: upgrade.modifyRange });
    }
    if (typeof upgrade.modifyCooldown === 'number' && upgrade.modifyCooldown !== 0) {
        patches.push({ field: 'cooldown', op: 'add', value: upgrade.modifyCooldown });
    }
    if (typeof upgrade.modifyDamage === 'number' && upgrade.modifyDamage !== 0) {
        patches.push({ field: 'damage', op: 'add', value: upgrade.modifyDamage });
    }
    if (rank <= 1) return patches;
    return patches.map(patch => {
        if (patch.rankMode !== 'linear') return patch;
        if (patch.op === 'add' && typeof patch.value === 'number') {
            return { ...patch, value: patch.value * rank };
        }
        if (patch.op === 'add' && typeof patch.scaledValue === 'number') {
            return { ...patch, scaledValue: patch.scaledValue * rank };
        }
        if (patch.op === 'multiply') {
            const scale = patchScale(patch);
            const baseFactor = typeof patch.scaledValue === 'number'
                ? Number(patch.scaledValue) / scale
                : Number(patch.value || 0);
            const linearFactor = 1 + ((baseFactor - 1) * rank);
            return {
                ...patch,
                op: 'multiply',
                value: linearFactor,
                scaledValue: undefined,
                coefficientScale: undefined
            };
        }
        return patch;
    });
};

const getSkillUpgradeMap = (skill: SkillDefinition): Record<string, UpgradeLike> => skill.upgrades || {};

const isStationarySatisfied = (context: SkillUpgradeResolutionContext | undefined, upgrade: UpgradeLike): boolean =>
    !upgrade.requiresStationary || Boolean(context?.heldPosition);

const patchScale = (patch: SkillUpgradePatchDefinition): number =>
    Number.isFinite(patch.coefficientScale) && Number(patch.coefficientScale || 0) > 0
        ? Number(patch.coefficientScale)
        : SCALED_IDENTITY;

const readPatchNumber = (patch: SkillUpgradePatchDefinition): number => {
    if (typeof patch.scaledValue === 'number') {
        return Number(patch.scaledValue) / patchScale(patch);
    }
    return Number(patch.value || 0);
};

const applyNumericPatch = (
    current: number | undefined,
    patch: SkillUpgradePatchDefinition
): number => {
    const base = Number.isFinite(current) ? Number(current) : 0;
    const value = readPatchNumber(patch);
    if (patch.op === 'multiply') return base * value;
    if (patch.op === 'add') return base + value;
    return value;
};

const applySkillUpgradePatch = (
    skill: SkillDefinition,
    patch: SkillUpgradePatchDefinition
): void => {
    switch (patch.field) {
        case 'range':
            skill.baseVariables.range = applyNumericPatch(skill.baseVariables.range, patch);
            return;
        case 'cooldown':
            skill.baseVariables.cooldown = applyNumericPatch(skill.baseVariables.cooldown, patch);
            return;
        case 'damage':
            skill.baseVariables.damage = applyNumericPatch(skill.baseVariables.damage, patch);
            return;
        case 'basePower':
            skill.baseVariables.basePower = applyNumericPatch(skill.baseVariables.basePower, patch);
            return;
        case 'momentum':
            skill.baseVariables.momentum = applyNumericPatch(skill.baseVariables.momentum, patch);
            return;
        case 'leechRatio': {
            const combat = skill.combat || {
                damageClass: 'physical',
                attackProfile: 'melee',
                trackingSignature: 'melee',
                weights: {}
            };
            combat.leechRatio = applyNumericPatch(combat.leechRatio, patch);
            skill.combat = combat;
            return;
        }
        case 'damageClass': {
            const combat = skill.combat || {
                damageClass: 'physical',
                attackProfile: 'melee',
                trackingSignature: 'melee',
                weights: {}
            };
            if (typeof patch.value === 'string') combat.damageClass = patch.value as any;
            skill.combat = combat;
            return;
        }
        case 'damageSubClass': {
            const combat = skill.combat || {
                damageClass: 'physical',
                attackProfile: 'melee',
                trackingSignature: 'melee',
                weights: {}
            };
            if (typeof patch.value === 'string') combat.damageSubClass = patch.value as any;
            skill.combat = combat;
            return;
        }
        case 'damageElement': {
            const combat = skill.combat || {
                damageClass: 'physical',
                attackProfile: 'melee',
                trackingSignature: 'melee',
                weights: {}
            };
            if (typeof patch.value === 'string') combat.damageElement = patch.value as any;
            skill.combat = combat;
            return;
        }
        case 'attackProfile': {
            const combat = skill.combat || {
                damageClass: 'physical',
                attackProfile: 'melee',
                trackingSignature: 'melee',
                weights: {}
            };
            if (typeof patch.value === 'string') combat.attackProfile = patch.value as any;
            skill.combat = combat;
            return;
        }
        case 'trackingSignature': {
            const combat = skill.combat || {
                damageClass: 'physical',
                attackProfile: 'melee',
                trackingSignature: 'melee',
                weights: {}
            };
            if (typeof patch.value === 'string') combat.trackingSignature = patch.value as any;
            skill.combat = combat;
            return;
        }
        default:
            return;
    }
};

export const resolveSkillUpgradeSelection = (
    skill: SkillDefinition,
    activeUpgradeIds: string[],
    context?: SkillUpgradeResolutionContext
): SkillUpgradeSelectionResult => {
    const upgradeMap = getSkillUpgradeMap(skill);
    const requestedIds = new Set(activeUpgradeIds);
    const requested = activeUpgradeIds
        .map(upgradeId => upgradeMap[upgradeId])
        .filter((upgrade): upgrade is UpgradeLike => Boolean(upgrade));

    const eligible = requested.filter(upgrade => isStationarySatisfied(context, upgrade));
    const byId = new Map(eligible.map(upgrade => [upgrade.id, upgrade]));
    const candidates = [...byId.values()].sort(compareUpgrades);
    const selected: UpgradeLike[] = [];
    const rejected: string[] = [];
    const occupiedKeys = new Set<string>();
    const blacklistedIds = new Set<string>();
    const totalRequestedPoints = countRequestedRanks(upgradeMap, activeUpgradeIds, context);

    for (const upgrade of candidates) {
        const rank = resolveUpgradeRank(upgrade, context);
        if (upgrade.maxRanks !== undefined && rank > upgrade.maxRanks) {
            rejected.push(upgrade.id);
            continue;
        }
        if (rank <= 0) {
            rejected.push(upgrade.id);
            continue;
        }
        const keys = [
            getUpgradeGroupId(upgrade) ? `group:${getUpgradeGroupId(upgrade)}` : undefined,
            ...(upgrade.compatibilityTags || []).map(tag => `tag:${tag}`)
        ].filter((key): key is string => Boolean(key));

        if (blacklistedIds.has(upgrade.id)) {
            rejected.push(upgrade.id);
            continue;
        }

        const requirements = getUpgradeRequirementRanks(upgrade);
        if (requirements.length > 0 && requirements.some(requirement => {
            const matchedUpgrade = upgradeMap[requirement.upgradeId];
            const rank = resolveUpgradeRank(matchedUpgrade || { id: requirement.upgradeId } as UpgradeLike, context);
            return !requestedIds.has(requirement.upgradeId) || rank < requirement.minRank;
        })) {
            rejected.push(upgrade.id);
            continue;
        }
        if (typeof upgrade.requiresPointsInSkill === 'number' && totalRequestedPoints < upgrade.requiresPointsInSkill) {
            rejected.push(upgrade.id);
            continue;
        }

        if (keys.some(key => occupiedKeys.has(key))) {
            rejected.push(upgrade.id);
            continue;
        }

        selected.push(upgrade);
        keys.forEach(key => occupiedKeys.add(key));
        getUpgradeIncompatibilities(upgrade).forEach(upgradeId => blacklistedIds.add(upgradeId));
    }

    const active = selected.map(upgrade => upgrade.id);
    const activeSet = new Set(active);
    const rejectedUpgradeIds = [
        ...activeUpgradeIds.filter(upgradeId => !upgradeMap[upgradeId] || !activeSet.has(upgradeId)),
        ...rejected
    ];
    return {
        activeUpgradeIds: active,
        rejectedUpgradeIds: [...new Set(rejectedUpgradeIds)]
    };
};

export const resolveVirtualSkillDefinition = (
    skill: SkillDefinition,
    activeUpgradeIds: string[],
    context?: SkillUpgradeResolutionContext
): ResolvedSkillDefinitionResult => {
    const selection = resolveSkillUpgradeSelection(skill, activeUpgradeIds, context);
    const resolved = cloneSkillDefinition(skill);
    const upgradeMap = getSkillUpgradeMap(skill);
    for (const upgradeId of selection.activeUpgradeIds) {
        const upgrade = upgradeMap[upgradeId];
        if (!upgrade) continue;
        const rank = resolveUpgradeRank(upgrade, context);
        for (const patch of expandUpgradePatches(upgrade, rank)) {
            applySkillUpgradePatch(resolved, patch);
        }
    }
    return {
        skill: resolved,
        activeUpgradeIds: selection.activeUpgradeIds,
        rejectedUpgradeIds: selection.rejectedUpgradeIds
    };
};
