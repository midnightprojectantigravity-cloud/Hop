import type { Actor, GameState } from '../../types';
import type {
    ResolutionTrace,
    ResolutionTraceMode,
    ResolvedSkillRuntime,
    SkillPhysicsPlan,
    SkillRuntimeDefinition
} from './types';
import { evaluateRuntimeSkillPredicate } from './targeting';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createTrace = (mode: ResolutionTraceMode): ResolutionTrace => ({
    mode,
    entries: []
});

const appendTrace = (trace: ResolutionTrace, entry: ResolutionTrace['entries'][number]): void => {
    if (trace.mode === 'none') return;
    if (trace.mode === 'summary' && entry.kind !== 'patch' && entry.kind !== 'keyword' && entry.kind !== 'physics') return;
    trace.entries.push(entry);
};

const parsePathSegments = (path: string): string[] =>
    path.split('.').filter(Boolean);

const getNestedValue = (target: unknown, path: string): unknown => {
    let cursor = target as Record<string, unknown> | undefined;
    for (const segment of parsePathSegments(path)) {
        if (!cursor || typeof cursor !== 'object') return undefined;
        cursor = cursor[segment] as Record<string, unknown> | undefined;
    }
    return cursor;
};

const setNestedValue = (
    target: unknown,
    path: string,
    op: 'set' | 'add' | 'multiply',
    value: number | boolean | string
): unknown => {
    const segments = parsePathSegments(path);
    if (segments.length === 0) return target;
    let cursor = target as Record<string, unknown>;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const segment = segments[index]!;
        const next = cursor[segment];
        if (!next || typeof next !== 'object') return target;
        cursor = next as Record<string, unknown>;
    }
    const leaf = segments[segments.length - 1]!;
    const current = cursor[leaf];
    if (op === 'set') cursor[leaf] = value;
    else if (typeof current === 'number' && typeof value === 'number' && op === 'add') cursor[leaf] = current + value;
    else if (typeof current === 'number' && typeof value === 'number' && op === 'multiply') cursor[leaf] = current * value;
    return target;
};

type RuntimeResolutionContext = {
    state?: GameState;
    attacker?: Actor;
};

const matchesRuntimePredicates = (
    definition: { when: any[] },
    context: RuntimeResolutionContext,
    trace: ResolutionTrace
): boolean => {
    if (!context.state || !context.attacker) return false;
    return definition.when.every(predicate =>
        evaluateRuntimeSkillPredicate(
            predicate,
            context.state!,
            context.attacker!,
            context.attacker!.position,
            trace
        )
    );
};

export const resolveSkillRuntime = (
    definition: SkillRuntimeDefinition,
    activeUpgradeIds: string[] = [],
    traceMode: ResolutionTraceMode = 'summary',
    context: RuntimeResolutionContext = {}
): ResolvedSkillRuntime => {
    const runtime = clone(definition);
    const trace = createTrace(traceMode);
    const resolvedKeywords = new Set(runtime.keywords);

    const targetingVariant = runtime.targetingVariants?.find(variant => matchesRuntimePredicates(variant, context, trace));
    if (targetingVariant) {
        runtime.targeting = {
            ...runtime.targeting,
            ...clone(targetingVariant.targeting)
        };
        appendTrace(trace, {
            kind: 'patch',
            path: 'targetingVariants',
            message: `Applied targeting variant for "${runtime.id}".`
        });
    }

    const presentationVariant = runtime.presentationVariants?.find(variant => matchesRuntimePredicates(variant, context, trace));
    if (presentationVariant) {
        if (presentationVariant.name) runtime.name = presentationVariant.name;
        if (presentationVariant.description) runtime.description = presentationVariant.description;
        if (presentationVariant.icon) runtime.icon = presentationVariant.icon;
        appendTrace(trace, {
            kind: 'patch',
            path: 'presentationVariants',
            message: `Applied presentation variant for "${runtime.id}".`
        });
    }

    for (const upgradeId of activeUpgradeIds) {
        resolvedKeywords.add(upgradeId);
        const upgrade = runtime.upgrades[upgradeId];
        if (!upgrade) continue;
        if (upgrade.when?.length) {
            const evaluationState = context.state;
            const evaluationAttacker = context.attacker;
            if (!evaluationState || !evaluationAttacker) {
                continue;
            }
            const upgradeApplies = upgrade.when.every(predicate =>
                evaluateRuntimeSkillPredicate(
                    predicate,
                    evaluationState,
                    evaluationAttacker,
                    evaluationAttacker.position,
                    trace
                )
            );
            if (!upgradeApplies) {
                appendTrace(trace, {
                    kind: 'patch',
                    path: `upgrades.${upgradeId}.when`,
                    message: `Skipped upgrade "${upgradeId}" because its runtime conditions failed.`
                });
                continue;
            }
        }

        for (const keyword of upgrade.addKeywords || []) {
            resolvedKeywords.add(keyword);
            appendTrace(trace, {
                kind: 'keyword',
                path: `upgrades.${upgradeId}.addKeywords`,
                message: `Added keyword "${keyword}".`,
                after: keyword
            });
        }

        for (const keyword of upgrade.removeKeywords || []) {
            resolvedKeywords.delete(keyword);
            appendTrace(trace, {
                kind: 'keyword',
                path: `upgrades.${upgradeId}.removeKeywords`,
                message: `Removed keyword "${keyword}".`,
                before: keyword
            });
        }

        for (const patch of upgrade.modifyNumbers || []) {
            const before = getNestedValue(runtime, patch.path);
            setNestedValue(runtime, patch.path, patch.op, patch.value);
            const after = getNestedValue(runtime, patch.path);
            appendTrace(trace, {
                kind: 'patch',
                path: patch.path,
                message: `Applied ${patch.op}(${patch.value}) from upgrade "${upgradeId}".`,
                before,
                after
            });
        }

        for (const patch of upgrade.instructionPatches || []) {
            const instruction = runtime.combatScript.find(candidate => candidate.id === patch.instructionId);
            if (!instruction) continue;
            const before = getNestedValue(instruction, patch.path);
            setNestedValue(instruction, patch.path, patch.op, patch.value);
            const after = getNestedValue(instruction, patch.path);
            appendTrace(trace, {
                kind: 'patch',
                path: `combatScript.${patch.instructionId}.${patch.path}`,
                message: `Patched instruction "${patch.instructionId}" via upgrade "${upgradeId}".`,
                before,
                after
            });
        }

        if (upgrade.addInstructions?.length) {
            runtime.combatScript.push(...clone(upgrade.addInstructions));
            appendTrace(trace, {
                kind: 'patch',
                path: `upgrades.${upgradeId}.addInstructions`,
                message: `Appended ${upgrade.addInstructions.length} combat instruction(s).`,
                metadata: { count: upgrade.addInstructions.length }
            });
        }
    }

    runtime.combatScript.sort((left, right) => {
        const phaseOrder = ['declare', 'movement', 'collision', 'resolution', 'cleanup'];
        const leftIndex = phaseOrder.indexOf(left.phase);
        const rightIndex = phaseOrder.indexOf(right.phase);
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
        return String(left.id || '').localeCompare(String(right.id || ''));
    });

    const physicsPlan: SkillPhysicsPlan = runtime.physicsPlan || { kernel: 'none' };
    if (physicsPlan.baseMomentum !== undefined) {
        appendTrace(trace, {
            kind: 'physics',
            path: 'physicsPlan.baseMomentum',
            message: `Resolved base momentum to ${physicsPlan.baseMomentum}.`,
            after: physicsPlan.baseMomentum
        });
    }

    return {
        runtime,
        activeUpgradeIds: activeUpgradeIds.filter(id => !!definition.upgrades[id]),
        resolvedKeywords: [...resolvedKeywords],
        targeting: {
            ...runtime.targeting,
            deterministicSort: runtime.targeting.deterministicSort || 'distance_then_q_then_r'
        },
        movementPolicy: runtime.movementPolicy,
        combatScript: runtime.combatScript,
        physicsPlan,
        trace
    };
};
